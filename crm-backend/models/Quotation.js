const mongoose = require('mongoose');

const quotationItemSchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true },
    quantity: { type: Number, min: 0.01, default: 1 },
    unitRate: { type: Number, min: 0, default: 0 },
    taxRate: { type: Number, min: 0, max: 100, default: 18 },
    amount: { type: Number, min: 0, default: 0 },
  },
  { _id: false },
);

const quotationCustomFieldSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 60 },
    value: { type: String, required: true, trim: true, maxlength: 240 },
  },
  { _id: false },
);

const quotationSchema = new mongoose.Schema(
  {
    quotationNumber: { type: String, required: true, unique: true, index: true },
    businessUnitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BusinessUnit',
      required: true,
      index: true,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
      index: true,
    },
    communityKey: { type: String, required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    clientName: { type: String, required: true, trim: true },
    clientCompany: { type: String, default: '', trim: true },
    clientEmail: { type: String, required: true, trim: true, lowercase: true },
    clientPhone: { type: String, default: '', trim: true },
    clientAddress: { type: String, default: '', trim: true },
    subject: { type: String, required: true, trim: true },
    documentType: {
      type: String,
      enum: ['quotation', 'marketing-proposal', 'social-media-proposal'],
      default: 'quotation',
      index: true,
    },
    proposalServices: { type: [String], default: [] },
    deliverables: { type: [String], default: [] },
    logoDataUrl: { type: String, default: '' },
    quotationDate: { type: String, required: true },
    validUntil: { type: String, required: true },
    customFields: { type: [quotationCustomFieldSchema], default: [] },
    items: { type: [quotationItemSchema], default: [] },
    subtotal: { type: Number, min: 0, default: 0 },
    discountType: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
    discountValue: { type: Number, min: 0, default: 0 },
    discountAmount: { type: Number, min: 0, default: 0 },
    taxableAmount: { type: Number, min: 0, default: 0 },
    taxAmount: { type: Number, min: 0, default: 0 },
    grandTotal: { type: Number, min: 0, default: 0 },
    currency: { type: String, default: 'INR' },
    notes: { type: String, default: '', trim: true },
    terms: {
      type: String,
      default:
        'Prices are valid until the quotation expiry date. Work begins after written approval and agreed advance payment.',
      trim: true,
    },
    status: {
      type: String,
      enum: ['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired'],
      default: 'Draft',
      index: true,
    },
    sentAt: { type: Date, default: null },
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    emailMessageId: { type: String, default: '' },
  },
  { timestamps: true },
);

quotationSchema.index({ businessUnitId: 1, createdAt: -1 });
quotationSchema.index({ createdBy: 1, createdAt: -1 });

module.exports = mongoose.model('Quotation', quotationSchema);
