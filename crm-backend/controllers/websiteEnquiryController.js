const mongoose = require('mongoose');
const Counter = require('../models/Counter');
const User = require('../models/User');
const WebsiteEnquiry = require('../models/WebsiteEnquiry');
const {
  COMMUNITIES,
  NUMBER_PREFIXES,
  PRIORITIES,
  STATUSES,
} = require('../constants/websiteEnquiry');

const normalize = (value, maximumLength = 5000) =>
  String(value ?? '')
    .trim()
    .slice(0, maximumLength);
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const populate = (query) =>
  query
    .populate('assignedTo', 'name email employeeId')
    .populate('activity.changedBy', 'name email')
    .populate('meetingIds', 'meetingTitle meetingDate meetingTime status');

const httpError = (status, message) => Object.assign(new Error(message), { status });

const getCommunityKey = (value) => {
  const communityKey = normalize(value, 32).toLowerCase() || 'marketing';
  if (!COMMUNITIES.includes(communityKey)) throw httpError(400, 'Invalid enquiry business unit');
  return communityKey;
};

const ensureCommunityAccess = (user, communityKey) => {
  if (user.roleKey !== 'super_admin' && !(user.communities || []).includes(communityKey)) {
    throw httpError(403, 'Community access denied');
  }
};

const scopedQuery = (req, communityKey, filters = {}) => ({
  $and: [{ communityKey }, req.accessQuery || {}, filters],
});

const getNextNumber = async (communityKey) => {
  const counter = await Counter.findOneAndUpdate(
    { key: `website_enquiry_${communityKey}` },
    { $inc: { value: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  return `${NUMBER_PREFIXES[communityKey]}-${String(counter.value).padStart(5, '0')}`;
};

const createWithUniqueNumber = async (communityKey, payload) => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await WebsiteEnquiry.create({
        ...payload,
        enquiryNumber: await getNextNumber(communityKey),
      });
    } catch (error) {
      if (error.code !== 11000 || attempt === 2) {
        throw error;
      }
    }
  }

  throw httpError(500, 'Unable to generate an enquiry number');
};

const getSafeEnquiryFields = (body) => ({
  name: normalize(body.name, 160),
  email: normalize(body.email, 254).toLowerCase(),
  phone: normalize(body.phone, 30),
  company: normalize(body.company, 200),
  serviceCategory: normalize(body.serviceCategory, 160),
  service: normalize(body.service, 240),
  message: normalize(body.message, 10000),
  source: normalize(body.source, 160),
  pageUrl: normalize(body.pageUrl, 2048),
});

const validateRequiredEnquiryFields = ({ name, email, phone }) => {
  if (!name || !email || !phone) {
    throw httpError(400, 'Name, email and phone are required');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw httpError(400, 'Enter a valid email address');
  }

  const phoneDigits = phone.replace(/\D/g, '');
  if (phoneDigits.length < 7 || phoneDigits.length > 15) {
    throw httpError(400, 'Enter a valid phone number');
  }
};

const createPublicEnquiry = async (req, res, next) => {
  try {
    const communityKey = 'marketing';
    const safeFields = getSafeEnquiryFields(req.body);
    validateRequiredEnquiryFields(safeFields);

    const enquiry = await createWithUniqueNumber(communityKey, {
      ...safeFields,
      communityKey,
      source: safeFields.source || 'BrainADZ website',
      priority: 'Medium',
      status: 'Pending',
      createdBy: null,
      activity: [
        {
          type: 'created',
          message: 'Enquiry received from BrainADZ website',
          changedBy: null,
          changedByName: 'BrainADZ Website',
        },
      ],
    });

    return res.status(201).json({
      message: 'Enquiry submitted successfully',
      enquiryNumber: enquiry.enquiryNumber,
    });
  } catch (error) {
    return next(error);
  }
};

const getOptions = async (req, res, next) => {
  try {
    const communityKey = getCommunityKey(req.query.communityKey);
    ensureCommunityAccess(req.user, communityKey);
    const employees = await User.find({
      userType: 'employee',
      accountStatus: 'active',
      isDeleted: { $ne: true },
      communities: communityKey,
    })
      .select('name email employeeId communities')
      .sort({ name: 1 })
      .lean();
    res.json({ statuses: STATUSES, employees });
  } catch (error) {
    next(error);
  }
};

const listEnquiries = async (req, res, next) => {
  try {
    const communityKey = getCommunityKey(req.query.communityKey);
    ensureCommunityAccess(req.user, communityKey);
    const filters = {};
    const status = normalize(req.query.status, 40);
    if (status && status !== 'all') {
      if (!STATUSES.includes(status)) throw httpError(400, 'Invalid status filter');
      filters.status = status;
    }
    const employeeId = normalize(req.query.employee, 64);
    if (employeeId && employeeId !== 'all') {
      if (!mongoose.isValidObjectId(employeeId)) throw httpError(400, 'Invalid employee filter');
      filters.assignedTo = employeeId;
    }
    if (req.query.assignment === 'assigned') filters.assignedTo = { $ne: null };
    if (req.query.assignment === 'unassigned') filters.assignedTo = null;
    const search = normalize(req.query.search, 200);
    if (search) {
      const expression = new RegExp(escapeRegExp(search), 'i');
      filters.$or = ['enquiryNumber', 'name', 'company', 'email', 'phone', 'service'].map(
        (field) => ({ [field]: expression }),
      );
    }
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    const query = scopedQuery(req, communityKey, filters);
    const countQuery = scopedQuery(req, communityKey);
    const [items, total, counts] = await Promise.all([
      populate(
        WebsiteEnquiry.find(query)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit),
      ).lean(),
      WebsiteEnquiry.countDocuments(query),
      WebsiteEnquiry.aggregate([
        { $match: countQuery },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);
    res.json({
      items,
      total,
      page,
      limit,
      statusCounts: Object.fromEntries(counts.map(({ _id, count }) => [_id, count])),
    });
  } catch (error) {
    next(error);
  }
};

const createEnquiry = async (req, res, next) => {
  try {
    const communityKey = getCommunityKey(req.body.communityKey);
    ensureCommunityAccess(req.user, communityKey);
    const safeFields = getSafeEnquiryFields(req.body);
    const priority = normalize(req.body.priority, 20) || 'Medium';
    validateRequiredEnquiryFields(safeFields);
    if (!PRIORITIES.includes(priority)) throw httpError(400, 'Invalid enquiry priority');
    const payload = {
      communityKey,
      ...safeFields,
      priority,
      source: safeFields.source || 'CRM',
      createdBy: req.user._id,
      activity: [
        {
          type: 'created',
          message: 'Enquiry created in CRM',
          changedBy: req.user._id,
          changedByName: req.user.name || req.user.email,
        },
      ],
    };
    const enquiry = await createWithUniqueNumber(communityKey, payload);
    res.status(201).json(await populate(WebsiteEnquiry.findById(enquiry._id)));
  } catch (error) {
    next(error);
  }
};

const assignEnquiries = async (req, res, next) => {
  try {
    const communityKey = getCommunityKey(req.body.communityKey);
    ensureCommunityAccess(req.user, communityKey);
    const ids = [...new Set((Array.isArray(req.body.ids) ? req.body.ids : []).map(String))].filter(
      (id) => mongoose.isValidObjectId(id),
    );
    if (!ids.length) throw httpError(400, 'Select at least one valid enquiry');
    const employeeId = normalize(req.body.employeeId, 64);
    let employee = null;
    if (employeeId) {
      if (!mongoose.isValidObjectId(employeeId)) throw httpError(400, 'Invalid employee ID');
      employee = await User.findOne({
        _id: employeeId,
        userType: 'employee',
        accountStatus: 'active',
        isDeleted: { $ne: true },
        communities: communityKey,
      }).select('name email');
      if (!employee) throw httpError(400, 'Employee is not active in this business unit');
    }
    const message = employee
      ? `Assigned to ${employee.name || employee.email}`
      : 'Enquiry unassigned';
    const result = await WebsiteEnquiry.updateMany(
      scopedQuery(req, communityKey, { _id: { $in: ids } }),
      {
        $set: {
          assignedTo: employee?._id || null,
          assignedBy: req.user._id,
          assignedAt: employee ? new Date() : null,
        },
        $push: {
          activity: {
            type: 'assignment',
            message,
            changedBy: req.user._id,
            changedByName: req.user.name || req.user.email,
          },
        },
      },
    );
    res.json({ message, updated: result.modifiedCount });
  } catch (error) {
    next(error);
  }
};

const updateAction = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) throw httpError(400, 'Invalid enquiry ID');
    const communityKey = getCommunityKey(req.body.communityKey);
    ensureCommunityAccess(req.user, communityKey);
    const enquiry = await WebsiteEnquiry.findOne(
      scopedQuery(req, communityKey, { _id: req.params.id }),
    );
    if (!enquiry) throw httpError(404, 'Enquiry not found or access denied');
    const nextStatus = normalize(req.body.status, 40);
    if (!STATUSES.includes(nextStatus)) throw httpError(400, 'Invalid status');
    const nextRemark = normalize(req.body.remark, 10000);
    const followUpDate = req.body.followUpDate ? new Date(req.body.followUpDate) : null;
    if (followUpDate && Number.isNaN(followUpDate.getTime()))
      throw httpError(400, 'Invalid follow-up date');
    if (nextStatus === 'Follow Up' && !followUpDate)
      throw httpError(400, 'Follow-up date is required');
    const previousStatus = enquiry.status;
    const previousRemark = enquiry.remark;
    enquiry.status = nextStatus;
    enquiry.remark = nextRemark;
    enquiry.followUpDate = nextStatus === 'Follow Up' ? followUpDate : null;
    if (previousStatus !== nextStatus || previousRemark !== nextRemark) {
      enquiry.activity.push({
        type: previousStatus !== nextStatus ? 'status' : 'remark',
        previousStatus,
        currentStatus: nextStatus,
        previousRemark,
        currentRemark: nextRemark,
        message:
          previousStatus !== nextStatus && previousRemark !== nextRemark
            ? 'Status and remark updated'
            : previousStatus !== nextStatus
              ? 'Status updated'
              : 'Remark updated',
        changedBy: req.user._id,
        changedByName: req.user.name || req.user.email,
      });
    }
    await enquiry.save();
    res.json(await populate(WebsiteEnquiry.findById(enquiry._id)));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  assignEnquiries,
  createEnquiry,
  createPublicEnquiry,
  getOptions,
  listEnquiries,
  updateAction,
};
