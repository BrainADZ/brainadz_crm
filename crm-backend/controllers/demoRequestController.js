const mongoose = require('mongoose');
const DemoRequest = require('../models/DemoRequest');
const { canAccessLiveDemoRequests } = require('../services/demoRequestAccessService');

const TYPES = ['erp', 'crm', 'pos', 'hospitality', 'software'];
const STATUSES = ['New', 'Contacted', 'Qualified', 'Closed'];
const SIZES = [
  '1-10 employees',
  '11-50 employees',
  '51-200 employees',
  '201-500 employees',
  '501+ employees',
];
const clean = (value, limit) => (typeof value === 'string' ? value.trim().slice(0, limit) : '');
const fail = (message, status = 400) => Object.assign(new Error(message), { status });

const normalizeRequest = (body = {}) => {
  const fields = {
    requestId: clean(body.requestId, 80),
    name: clean(body.name, 100),
    companyName: clean(body.companyName, 200),
    email: clean(body.email, 254).toLowerCase(),
    phone: clean(body.phone, 30),
    companySize: clean(body.companySize, 50),
    requirements: clean(body.requirements, 4000),
    demoType: clean(body.demoType, 30),
    pageUrl: clean(body.pageUrl, 2048),
    campaign: Object.fromEntries(
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid'].map(
        (key) => [key, clean(body.campaign?.[key], 500)],
      ),
    ),
  };
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(fields.requestId)
  )
    throw fail('Invalid request ID');
  if (
    !fields.name ||
    !fields.companyName ||
    !fields.requirements ||
    !TYPES.includes(fields.demoType) ||
    !SIZES.includes(fields.companySize)
  )
    throw fail('Complete all required demo fields');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) throw fail('Invalid email address');
  if (!/^\+?[\d\s().-]+$/.test(fields.phone) || !/^\d{7,15}$/.test(fields.phone.replace(/\D/g, '')))
    throw fail('Invalid phone number');
  if (fields.pageUrl && !/^https?:\/\//i.test(fields.pageUrl)) fields.pageUrl = '';
  return fields;
};

const ingestRequest = async (req, res, next) => {
  try {
    const fields = normalizeRequest(req.body);
    let request;
    try {
      request = await DemoRequest.findOneAndUpdate(
        { requestId: fields.requestId },
        { $setOnInsert: { ...fields, communityKey: 'live' } },
        { upsert: true, new: true, runValidators: true },
      );
    } catch (error) {
      if (error.code !== 11000) throw error;
      request = await DemoRequest.findOne({ requestId: fields.requestId });
    }
    for (const key of [
      'name',
      'companyName',
      'email',
      'phone',
      'demoType',
      'companySize',
      'requirements',
    ]) {
      if (request[key] !== fields[key]) throw fail('This request ID has already been used.', 409);
    }
    return res.status(200).json({ request });
  } catch (error) {
    return next(error);
  }
};

const updateDelivery = async (req, res, next) => {
  try {
    const { deliveryStatus, accessType } = req.body || {};
    if (!['pending', 'sent', 'failed'].includes(deliveryStatus))
      throw fail('Invalid delivery status');
    if (accessType && !['link', 'account', 'existing_account'].includes(accessType))
      throw fail('Invalid access type');
    const update = { deliveryStatus, deliveryError: clean(req.body.deliveryError, 500) };
    if (accessType) update.accessType = accessType;
    if (req.body.demoUrl) {
      const url = new URL(req.body.demoUrl);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
        throw fail('Invalid demo URL');
      update.demoUrl = url.href;
    }
    if (deliveryStatus === 'sent') update.emailedAt = new Date();
    const request = await DemoRequest.findOneAndUpdate(
      { requestId: req.params.requestId, communityKey: 'live' },
      { $set: update },
      { new: true, runValidators: true },
    );
    if (!request) throw fail('Demo request not found', 404);
    return res.json({ request });
  } catch (error) {
    return next(error);
  }
};

const checkAccess = async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    return res.json({ allowed: await canAccessLiveDemoRequests(req.user) });
  } catch (error) {
    return next(error);
  }
};

const listRequests = async (req, res, next) => {
  try {
    const page = Math.max(1, Math.min(100000, Number.parseInt(req.query.page, 10) || 1));
    const limit = 25;
    const filter = { communityKey: 'live' };
    if (STATUSES.includes(req.query.status)) filter.status = req.query.status;
    if (TYPES.includes(req.query.demoType)) filter.demoType = req.query.demoType;
    if (['pending', 'sent', 'failed'].includes(req.query.deliveryStatus))
      filter.deliveryStatus = req.query.deliveryStatus;
    const search = clean(req.query.search, 100);
    if (search) {
      const expression = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = ['name', 'companyName', 'email', 'phone'].map((key) => ({ [key]: expression }));
    }
    const [items, total] = await Promise.all([
      DemoRequest.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      DemoRequest.countDocuments(filter),
    ]);
    return res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (error) {
    return next(error);
  }
};

const updateRequest = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) throw fail('Invalid demo request ID');
    if (
      !STATUSES.includes(req.body?.status) ||
      typeof req.body.notes !== 'string' ||
      req.body.notes.length > 4000
    )
      throw fail('Provide a valid status and notes (up to 4000 characters).');
    const request = await DemoRequest.findOneAndUpdate(
      { _id: req.params.id, communityKey: 'live' },
      { $set: { status: req.body.status, notes: req.body.notes.trim(), updatedBy: req.user._id } },
      { new: true, runValidators: true },
    );
    if (!request) throw fail('Demo request not found', 404);
    return res.json({ request });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  ingestRequest,
  updateDelivery,
  checkAccess,
  listRequests,
  updateRequest,
  normalizeRequest,
};
