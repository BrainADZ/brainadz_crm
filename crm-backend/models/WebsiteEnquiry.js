const mongoose = require('mongoose');
const { COMMUNITIES, PRIORITIES, STATUSES } = require('../constants/websiteEnquiry');

const activitySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['created', 'status', 'remark', 'assignment', 'meeting'],
      required: true,
    },
    previousStatus: { type: String, default: '' },
    currentStatus: { type: String, default: '' },
    previousRemark: { type: String, default: '' },
    currentRemark: { type: String, default: '' },
    message: { type: String, default: '' },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    changedByName: { type: String, default: '' },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const websiteEnquirySchema = new mongoose.Schema(
  {
    enquiryNumber: { type: String, required: true, unique: true, index: true },
    communityKey: {
      type: String,
      enum: COMMUNITIES,
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    company: { type: String, default: '', trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    serviceCategory: { type: String, default: '', trim: true, index: true },
    service: { type: String, default: '', trim: true },
    message: { type: String, default: '', trim: true },
    source: { type: String, default: 'Website', trim: true, index: true },
    pageUrl: { type: String, default: '', trim: true },
    status: {
      type: String,
      enum: STATUSES,
      default: 'Pending',
      index: true,
    },
    priority: { type: String, enum: PRIORITIES, default: 'Medium', index: true },
    remark: { type: String, default: '', trim: true },
    followUpDate: { type: Date, default: null, index: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assignedAt: { type: Date, default: null },
    meetingIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Meeting' }],
    activity: { type: [activitySchema], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

websiteEnquirySchema.index({ communityKey: 1, createdAt: -1 });
websiteEnquirySchema.index({ communityKey: 1, status: 1, assignedTo: 1 });
websiteEnquirySchema.index({
  name: 'text',
  company: 'text',
  email: 'text',
  phone: 'text',
  service: 'text',
});

module.exports = mongoose.model('WebsiteEnquiry', websiteEnquirySchema);
