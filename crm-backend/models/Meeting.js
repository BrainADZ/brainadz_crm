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
    teamIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'OrganizationTeam' }],
    participantUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    clientVisible: { type: Boolean, default: false },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    dataset: { type: mongoose.Schema.Types.ObjectId, ref: 'ClientDataset', default: null },
    rowIndex: { type: Number, default: null },
    datasetName: { type: String, default: '' },
    clientName: { type: String, default: '' },
    companyName: { type: String, default: '' },
    meetingTitle: { type: String, required: true, trim: true },
    meetingDate: {
      type: String,
      required: true,
      validate: {
        validator: (value) => {
          const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
          if (!match) return false;
          const year = Number(match[1]);
          const month = Number(match[2]);
          const day = Number(match[3]);
          if (year < 1000) return false;
          const date = new Date(Date.UTC(year, month - 1, day));
          return (
            date.getUTCFullYear() === year &&
            date.getUTCMonth() === month - 1 &&
            date.getUTCDate() === day
          );
        },
        message: 'Meeting date must be a valid YYYY-MM-DD date',
      },
    },
    meetingTime: {
      type: String,
      required: true,
      match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'Meeting time must be a valid HH:mm time'],
    },
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
    reminderDate: { type: String, default: '', trim: true, select: false },
    reminderNotificationSentAt: { type: Date, default: null, select: false },
    reminderEmailSentAt: { type: Date, default: null, select: false },
    reminderEmailAttempts: { type: Number, min: 0, default: 0, select: false },
    reminderEmailLastAttemptAt: { type: Date, default: null, select: false },
    reminderEmailLastError: { type: String, default: '', trim: true, select: false },
    reminderProcessingAt: { type: Date, default: null, select: false },
  },
  {
    timestamps: true,
  },
);

meetingSchema.index({ communityKey: 1, employee: 1, meetingDate: 1 });
meetingSchema.index({ departmentId: 1, meetingDate: 1, meetingTime: 1 });
meetingSchema.index({ teamIds: 1, meetingDate: 1, meetingTime: 1 });
meetingSchema.index({ status: 1, meetingDate: 1, reminderProcessingAt: 1, employee: 1 });
meetingSchema.index({ dataset: 1, rowIndex: 1, status: 1, meetingDate: 1, meetingTime: 1 });

module.exports = mongoose.model('Meeting', meetingSchema);
