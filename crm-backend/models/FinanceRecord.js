const mongoose = require('mongoose');

const financeRecordSchema = new mongoose.Schema(
  {
    communityKey: { type: String, required: true, default: 'live', index: true },
    officeModule: { type: String, default: 'Accounts', trim: true, index: true },
    linkedUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessProject', default: null },
    type: {
      type: String,
      enum: ['quotation', 'invoice'],
      required: true,
    },
    code: { type: String, required: true, trim: true },
    client: { type: String, required: true, trim: true },
    amount: { type: Number, default: 0 },
    gst: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    paid: { type: Number, default: 0 },
    dueDate: { type: String, default: '' },
    issueDate: { type: String, default: () => new Date().toISOString().slice(0, 10) },
    status: { type: String, default: 'Draft', trim: true },
    owner: { type: String, default: 'Accounts', trim: true },
    notes: { type: String, default: '', trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
  },
);

financeRecordSchema.index({ communityKey: 1, type: 1, status: 1 });

financeRecordSchema.virtual('pending').get(function getPending() {
  if (this.type !== 'invoice') return 0;
  return Math.max(
    (this.amount || 0) + (this.gst || 0) - (this.discount || 0) - (this.paid || 0),
    0,
  );
});

financeRecordSchema.set('toJSON', { virtuals: true });
financeRecordSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('FinanceRecord', financeRecordSchema);
