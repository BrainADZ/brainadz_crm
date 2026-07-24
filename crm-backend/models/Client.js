const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  communityKey: { type: String, required: true, default: 'live', index: true },
  officeModule: { type: String, default: 'Sales', trim: true, index: true },
  team: { type: String, default: '', trim: true, index: true },
  linkedUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  name: { type: String, required: true },
  contactInfo: {
    phone: { type: String },
    email: { type: String }, // Ensure this is required
  },
  address: { type: String, required: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  callLogs: [
    {
      comment: { type: String, required: true }, // Make sure this is required
      callStatus: { type: String, required: true }, // Make sure this is required
      screenshotUrl: { type: String },
      timestamp: { type: Date, default: Date.now },
      employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
  ],
});

clientSchema.index({ communityKey: 1, assignedTo: 1 });

module.exports = mongoose.model('Client', clientSchema);
