const mongoose = require('mongoose');

const demoRequestSchema = new mongoose.Schema(
  {
    requestId: { type: String, required: true, unique: true },
    communityKey: { type: String, enum: ['live'], default: 'live', immutable: true },
    name: { type: String, required: true, maxlength: 100 },
    companyName: { type: String, required: true, maxlength: 200 },
    email: { type: String, required: true, lowercase: true, maxlength: 254 },
    phone: { type: String, required: true, maxlength: 30 },
    companySize: { type: String, required: true, maxlength: 50 },
    requirements: { type: String, required: true, maxlength: 4000 },
    demoType: {
      type: String,
      enum: ['erp', 'crm', 'pos', 'hospitality', 'software'],
      required: true,
    },
    pageUrl: { type: String, default: '', maxlength: 2048 },
    campaign: {
      utm_source: { type: String, default: '', maxlength: 500 },
      utm_medium: { type: String, default: '', maxlength: 500 },
      utm_campaign: { type: String, default: '', maxlength: 500 },
      utm_term: { type: String, default: '', maxlength: 500 },
      utm_content: { type: String, default: '', maxlength: 500 },
      gclid: { type: String, default: '', maxlength: 500 },
    },
    deliveryStatus: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
    accessType: { type: String, enum: ['link', 'account', 'existing_account'], default: 'link' },
    demoUrl: { type: String, default: '', maxlength: 2048 },
    deliveryError: { type: String, default: '', maxlength: 500 },
    emailedAt: { type: Date, default: null },
    status: { type: String, enum: ['New', 'Contacted', 'Qualified', 'Closed'], default: 'New' },
    notes: { type: String, default: '', maxlength: 4000 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

demoRequestSchema.index({ communityKey: 1, createdAt: -1 });

module.exports = mongoose.model('DemoRequest', demoRequestSchema);
