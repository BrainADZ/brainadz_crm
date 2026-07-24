const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema(
  {
    communityKey: { type: String, required: true, default: 'live', index: true },
    businessUnitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BusinessUnit',
      default: null,
      index: true,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
      index: true,
    },
    officeModule: { type: String, default: 'Sales', trim: true, index: true },
    team: { type: String, default: '', trim: true, index: true },
    participantUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    clientVisible: { type: Boolean, default: false },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    dataset: { type: mongoose.Schema.Types.ObjectId, ref: 'ClientDataset', default: null },
    rowIndex: { type: Number, default: null },
    datasetName: { type: String, default: '' },
    clientName: { type: String, default: '' },
    companyName: { type: String, default: '' },
    meetingTitle: { type: String, required: true, trim: true },
    meetingDate: { type: String, required: true },
    meetingTime: { type: String, required: true },
    durationMinutes: { type: Number, min: 15, max: 480, default: 30 },
    meetingMode: {
      type: String,
      enum: ['Physical', 'Online', 'Phone'],
      default: 'Online',
    },
    platformOrLocation: { type: String, default: '' },
    notes: { type: String, default: '' },
    status: {
      type: String,
      enum: ['scheduled', 'completed', 'cancelled'],
      default: 'scheduled',
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

meetingSchema.index({ communityKey: 1, employee: 1, meetingDate: 1 });
meetingSchema.index({ departmentId: 1, meetingDate: 1, meetingTime: 1 });

module.exports = mongoose.model('Meeting', meetingSchema);
