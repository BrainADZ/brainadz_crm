const express = require('express');
const mongoose = require('mongoose');
const Quotation = require('../models/Quotation');
const Counter = require('../models/Counter');
const BusinessUnit = require('../models/BusinessUnit');
const Department = require('../models/Department');
const UserAccessAssignment = require('../models/UserAccessAssignment');
const authMiddleware = require('../middleware/authMiddleware');
const { loadAuthorization, requirePermission } = require('../middleware/authorization');
const { generateQuotationPdf } = require('../services/quotationPdfService');
const { generateSocialMediaProposalPdf } = require('../services/socialMediaProposalPdfService');
const { sendQuotationEmail } = require('../services/emailService');
const { writeAuditLog } = require('../services/auditService');

const router = express.Router();
router.use(authMiddleware, loadAuthorization);

const isMarketingProposal = (quotation) =>
  ['marketing-proposal', 'social-media-proposal'].includes(quotation.documentType) ||
  /marketing/i.test(`${quotation.departmentId?.name || ''} ${quotation.departmentId?.slug || ''}`);

const generateDocumentPdf = (quotation) =>
  isMarketingProposal(quotation)
    ? generateSocialMediaProposalPdf(quotation)
    : generateQuotationPdf(quotation);

const activeAssignments = (userId) =>
  UserAccessAssignment.find({
    userId,
    status: 'active',
    startDate: { $lte: new Date() },
    $or: [{ endDate: null }, { endDate: { $gte: new Date() } }],
  })
    .select('businessUnitIds departmentId')
    .lean();

const populateQuotation = (query) =>
  query
    .populate('businessUnitId', 'name slug legacyCommunityKey')
    .populate('departmentId', 'name slug')
    .populate('createdBy', 'name email employeeId position')
    .populate('sentBy', 'name email');

const accessOrganization = async (user) => {
  if (user.roleKey === 'super_admin') {
    return Promise.all([
      BusinessUnit.find({ status: 'active' }).sort({ name: 1 }).lean(),
      Department.find({ status: 'active' }).sort({ name: 1 }).lean(),
    ]).then(([businessUnits, departments]) => ({ businessUnits, departments }));
  }
  const assignments = await activeAssignments(user._id);
  const unitIds = [
    ...new Set(assignments.flatMap((assignment) => assignment.businessUnitIds.map(String))),
  ];
  const departmentIds = [
    ...new Set(
      assignments.map((assignment) => String(assignment.departmentId || '')).filter(Boolean),
    ),
  ];
  const [businessUnits, departments] = await Promise.all([
    BusinessUnit.find({ _id: { $in: unitIds }, status: 'active' })
      .sort({ name: 1 })
      .lean(),
    Department.find({ _id: { $in: departmentIds }, status: 'active' })
      .sort({ name: 1 })
      .lean(),
  ]);
  return { businessUnits, departments };
};

const calculateTotals = (items, discountType, discountValue) => {
  const normalizedItems = (Array.isArray(items) ? items : []).map((item) => {
    const quantity = Number(item.quantity);
    const unitRate = Number(item.unitRate);
    const taxRate = Number(item.taxRate ?? 18);
    if (
      !String(item.description || '').trim() ||
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      !Number.isFinite(unitRate) ||
      unitRate < 0 ||
      !Number.isFinite(taxRate) ||
      taxRate < 0 ||
      taxRate > 100
    )
      throw Object.assign(
        new Error('Complete every quotation item with valid description, quantity, rate and GST'),
        { status: 400 },
      );
    return {
      description: String(item.description).trim(),
      quantity,
      unitRate,
      taxRate,
      amount: Number((quantity * unitRate).toFixed(2)),
    };
  });
  if (!normalizedItems.length)
    throw Object.assign(new Error('Add at least one quotation item'), { status: 400 });
  const subtotal = normalizedItems.reduce((total, item) => total + item.amount, 0);
  const rawDiscount = Math.max(0, Number(discountValue) || 0);
  const discountAmount =
    discountType === 'fixed'
      ? Math.min(subtotal, rawDiscount)
      : Math.min(subtotal, (subtotal * Math.min(rawDiscount, 100)) / 100);
  const taxableAmount = subtotal - discountAmount;
  const ratio = subtotal ? taxableAmount / subtotal : 0;
  const taxAmount =
    normalizedItems.reduce((total, item) => total + (item.amount * item.taxRate) / 100, 0) * ratio;
  return {
    items: normalizedItems,
    subtotal: Number(subtotal.toFixed(2)),
    discountAmount: Number(discountAmount.toFixed(2)),
    taxableAmount: Number(taxableAmount.toFixed(2)),
    taxAmount: Number(taxAmount.toFixed(2)),
    grandTotal: Number((taxableAmount + taxAmount).toFixed(2)),
  };
};

const normalizeCustomFields = (fields) =>
  (Array.isArray(fields) ? fields : [])
    .map((field) => ({
      label: String(field?.label || '').trim(),
      value: String(field?.value || '').trim(),
    }))
    .filter((field) => field.label || field.value)
    .map((field) => {
      if (!field.label || !field.value)
        throw Object.assign(new Error('Complete both label and value for every additional field'), {
          status: 400,
        });
      return { label: field.label.slice(0, 60), value: field.value.slice(0, 240) };
    })
    .slice(0, 12);

const normalizeLogo = (value) => {
  const logo = String(value || '');
  if (!logo) return '';
  if (!/^data:image\/(png|jpe?g);base64,/i.test(logo))
    throw Object.assign(new Error('Logo must be a PNG or JPG image'), { status: 400 });
  if (Buffer.byteLength(logo, 'utf8') > 6 * 1024 * 1024)
    throw Object.assign(new Error('Logo image is too large'), { status: 400 });
  return logo;
};

const normalizeProposal = (body, department) => {
  const marketingDepartment = /marketing/i.test(
    `${department?.name || ''} ${department?.slug || ''}`,
  );
  const proposalServices = [
    ...new Set(
      (Array.isArray(body.proposalServices) ? body.proposalServices : [])
        .map((service) => String(service || '').trim())
        .filter(Boolean)
        .map((service) => service.slice(0, 80)),
    ),
  ].slice(0, 15);
  const deliverables = (Array.isArray(body.deliverables) ? body.deliverables : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .map((item) => item.slice(0, 240))
    .slice(0, 30);
  if (marketingDepartment && !proposalServices.length)
    throw Object.assign(new Error('Select at least one marketing service'), { status: 400 });
  if (marketingDepartment && !deliverables.length)
    throw Object.assign(new Error('Add at least one proposal deliverable'), { status: 400 });
  return {
    documentType: marketingDepartment ? 'marketing-proposal' : 'quotation',
    proposalServices,
    deliverables,
  };
};

const nextQuotationNumber = async (communityKey) => {
  const year = new Date().getFullYear();
  const prefix = { marketing: 'MKT', exhibition: 'EXP', live: 'LIVE' }[communityKey] || 'QT';
  const counter = await Counter.findOneAndUpdate(
    { key: `quotation_${communityKey}_${year}` },
    { $inc: { value: 1 } },
    { new: true, upsert: true },
  );
  return `${prefix}-QT-${year}-${String(counter.value).padStart(4, '0')}`;
};

const assertOrganizationAccess = async (req, businessUnitId, departmentId) => {
  if (!mongoose.isValidObjectId(businessUnitId) || !mongoose.isValidObjectId(departmentId))
    throw Object.assign(new Error('Select a valid Business Unit and Department'), { status: 400 });
  const [unit, department] = await Promise.all([
    BusinessUnit.findOne({ _id: businessUnitId, status: 'active' }),
    Department.findOne({ _id: departmentId, status: 'active' }),
  ]);
  if (!unit || !department || !department.businessUnitIds.map(String).includes(String(unit._id)))
    throw Object.assign(new Error('Department is not available in the selected Business Unit'), {
      status: 400,
    });
  if (req.user.roleKey !== 'super_admin') {
    const assignment = await UserAccessAssignment.exists({
      userId: req.user._id,
      businessUnitIds: unit._id,
      departmentId: department._id,
      status: 'active',
      startDate: { $lte: new Date() },
      $or: [{ endDate: null }, { endDate: { $gte: new Date() } }],
    });
    if (!assignment)
      throw Object.assign(
        new Error(
          'You cannot create quotations outside your assigned Business Unit and Department',
        ),
        { status: 403 },
      );
  }
  return { unit, department };
};

const findAccessibleQuotation = async (req, quotationId) => {
  if (!mongoose.isValidObjectId(quotationId)) return null;
  if (req.user.roleKey === 'super_admin') return populateQuotation(Quotation.findById(quotationId));
  const assignmentList = await activeAssignments(req.user._id);
  const businessUnitIds = [
    ...new Set(assignmentList.flatMap((assignment) => assignment.businessUnitIds.map(String))),
  ];
  const permission = req.effectivePermissions.find((item) => item.resource === 'quotations');
  const scopeQuery = ['OWN', 'ASSIGNED', 'self', 'assigned'].includes(permission?.scope)
    ? { createdBy: req.user._id }
    : { businessUnitId: { $in: businessUnitIds } };
  return populateQuotation(Quotation.findOne({ _id: quotationId, ...scopeQuery }));
};

router.get('/options', requirePermission('quotations', 'view'), async (req, res, next) => {
  try {
    const organization = await accessOrganization(req.user);
    return res.json({
      ...organization,
      actions:
        req.effectivePermissions.find((permission) => permission.resource === 'quotations')
          ?.actions || [],
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/', requirePermission('quotations', 'view'), async (req, res, next) => {
  try {
    let query = {};
    if (req.user.roleKey !== 'super_admin') {
      const assignmentList = await activeAssignments(req.user._id);
      const businessUnitIds = [
        ...new Set(assignmentList.flatMap((assignment) => assignment.businessUnitIds)),
      ];
      const permission = req.effectivePermissions.find((item) => item.resource === 'quotations');
      query = ['OWN', 'ASSIGNED', 'self', 'assigned'].includes(permission?.scope)
        ? { createdBy: req.user._id }
        : { businessUnitId: { $in: businessUnitIds } };
    }
    const quotations = await populateQuotation(Quotation.find(query).sort({ createdAt: -1 }));
    return res.json(quotations);
  } catch (error) {
    return next(error);
  }
});

router.post('/', requirePermission('quotations', 'create'), async (req, res, next) => {
  try {
    const { unit, department } = await assertOrganizationAccess(
      req,
      req.body.businessUnitId,
      req.body.departmentId,
    );
    const clientEmail = String(req.body.clientEmail || '')
      .trim()
      .toLowerCase();
    if (
      !String(req.body.clientName || '').trim() ||
      !/^\S+@\S+\.\S+$/.test(clientEmail) ||
      !String(req.body.subject || '').trim()
    )
      return res
        .status(400)
        .json({ message: 'Client name, valid email and quotation subject are required' });
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(req.body.quotationDate) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(req.body.validUntil) ||
      req.body.validUntil < req.body.quotationDate
    )
      return res.status(400).json({ message: 'Select valid quotation and expiry dates' });
    const totals = calculateTotals(req.body.items, req.body.discountType, req.body.discountValue);
    const customFields = normalizeCustomFields(req.body.customFields);
    const logoDataUrl = normalizeLogo(req.body.logoDataUrl);
    const quotationNumber = await nextQuotationNumber(unit.legacyCommunityKey);
    const quotation = await Quotation.create({
      quotationNumber,
      businessUnitId: unit._id,
      departmentId: department._id,
      communityKey: unit.legacyCommunityKey,
      createdBy: req.user._id,
      clientName: String(req.body.clientName).trim(),
      clientCompany: String(req.body.clientCompany || '').trim(),
      clientEmail,
      clientPhone: String(req.body.clientPhone || '').trim(),
      clientAddress: String(req.body.clientAddress || '').trim(),
      subject: String(req.body.subject).trim(),
      logoDataUrl,
      customFields,
      ...normalizeProposal(req.body, department),
      quotationDate: String(req.body.quotationDate || '').trim(),
      validUntil: String(req.body.validUntil || '').trim(),
      ...totals,
      discountType: req.body.discountType === 'fixed' ? 'fixed' : 'percentage',
      discountValue: Math.max(0, Number(req.body.discountValue) || 0),
      notes: String(req.body.notes || '').trim(),
      terms: String(req.body.terms || '').trim() || undefined,
    });
    await writeAuditLog({
      req,
      action: 'quotation_created',
      resource: 'quotations',
      resourceId: quotation._id,
      newValue: { quotationNumber, clientEmail, grandTotal: totals.grandTotal },
    });
    return res.status(201).json({
      message: `${quotationNumber} created successfully`,
      quotation: await populateQuotation(Quotation.findById(quotation._id)),
    });
  } catch (error) {
    return next(error);
  }
});

router.put('/:id', requirePermission('quotations', 'update'), async (req, res, next) => {
  try {
    const quotation = await findAccessibleQuotation(req, req.params.id);
    if (!quotation) return res.status(404).json({ message: 'Quotation not found' });
    const { unit, department } = await assertOrganizationAccess(
      req,
      req.body.businessUnitId,
      req.body.departmentId,
    );
    const clientEmail = String(req.body.clientEmail || '')
      .trim()
      .toLowerCase();
    if (
      !String(req.body.clientName || '').trim() ||
      !/^\S+@\S+\.\S+$/.test(clientEmail) ||
      !String(req.body.subject || '').trim()
    )
      return res
        .status(400)
        .json({ message: 'Client name, valid email and quotation subject are required' });
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(req.body.quotationDate) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(req.body.validUntil) ||
      req.body.validUntil < req.body.quotationDate
    )
      return res.status(400).json({ message: 'Select valid quotation and expiry dates' });
    const totals = calculateTotals(req.body.items, req.body.discountType, req.body.discountValue);
    const previousValue = {
      clientEmail: quotation.clientEmail,
      grandTotal: quotation.grandTotal,
      status: quotation.status,
    };
    Object.assign(quotation, {
      businessUnitId: unit._id,
      departmentId: department._id,
      communityKey: unit.legacyCommunityKey,
      clientName: String(req.body.clientName).trim(),
      clientCompany: String(req.body.clientCompany || '').trim(),
      clientEmail,
      clientPhone: String(req.body.clientPhone || '').trim(),
      clientAddress: String(req.body.clientAddress || '').trim(),
      subject: String(req.body.subject).trim(),
      logoDataUrl: normalizeLogo(req.body.logoDataUrl),
      customFields: normalizeCustomFields(req.body.customFields),
      ...normalizeProposal(req.body, department),
      quotationDate: String(req.body.quotationDate).trim(),
      validUntil: String(req.body.validUntil).trim(),
      ...totals,
      discountType: req.body.discountType === 'fixed' ? 'fixed' : 'percentage',
      discountValue: Math.max(0, Number(req.body.discountValue) || 0),
      notes: String(req.body.notes || '').trim(),
      terms: String(req.body.terms || '').trim() || undefined,
      status: 'Draft',
      sentAt: null,
      sentBy: null,
      emailMessageId: '',
    });
    await quotation.save();
    await writeAuditLog({
      req,
      action: 'quotation_updated',
      resource: 'quotations',
      resourceId: quotation._id,
      previousValue,
      newValue: { clientEmail, grandTotal: totals.grandTotal, status: 'Draft' },
    });
    return res.json({
      message: `${quotation.quotationNumber} updated successfully`,
      quotation: await populateQuotation(Quotation.findById(quotation._id)),
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id/pdf', requirePermission('quotations', 'view'), async (req, res, next) => {
  try {
    const quotation = await findAccessibleQuotation(req, req.params.id);
    if (!quotation) return res.status(404).json({ message: 'Quotation not found' });
    const pdf = await generateDocumentPdf(quotation);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${quotation.quotationNumber}.pdf"`);
    return res.send(pdf);
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/send', requirePermission('quotations', 'create'), async (req, res, next) => {
  try {
    const quotation = await findAccessibleQuotation(req, req.params.id);
    if (!quotation) return res.status(404).json({ message: 'Quotation not found' });
    if (
      req.user.roleKey !== 'super_admin' &&
      String(quotation.createdBy?._id || quotation.createdBy) !== String(req.user._id)
    )
      return res.status(403).json({ message: 'You can send only quotations created by you' });
    const pdf = await generateDocumentPdf(quotation);
    const mail = await sendQuotationEmail({ quotation, pdfBuffer: pdf });
    quotation.status = 'Sent';
    quotation.sentAt = new Date();
    quotation.sentBy = req.user._id;
    quotation.emailMessageId = mail.messageId || '';
    await quotation.save();
    await writeAuditLog({
      req,
      action: 'quotation_sent',
      resource: 'quotations',
      resourceId: quotation._id,
      newValue: { recipient: quotation.clientEmail, messageId: mail.messageId },
    });
    return res.json({
      message: `${quotation.quotationNumber} sent to ${quotation.clientEmail}`,
      quotation: await populateQuotation(Quotation.findById(quotation._id)),
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
