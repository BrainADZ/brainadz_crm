const mongoose = require('mongoose');

const reportEntrySchema = new mongoose.Schema({
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessProject', default: null },
  projectName: { type: String, default: '', trim: true },
  task: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessProjectTask', default: null },
  taskName: { type: String, default: '', trim: true },
  workType: { type: String, enum: ['Development', 'Testing', 'Meeting', 'Others'], required: true },
  workSummary: { type: String, required: true, trim: true, maxlength: 5000 },
  hoursSpent: { type: Number, required: true, min: 0.25, max: 24 },
}, { _id: false });

const developmentDailyReportSchema = new mongoose.Schema(
  {
    communityKey: { type: String, required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reportDate: { type: String, required: true },
    status: { type: String, enum: ['draft', 'submitted'], default: 'submitted' },
    submittedAt: { type: Date, default: null },
    entries: { type: [reportEntrySchema], default: [] },
    additionalNotes: { type: String, default: '', trim: true, maxlength: 3000 },
    attachments: [{
      name: { type: String, required: true },
      mimeType: { type: String, required: true },
      size: { type: Number, required: true },
      storageName: { type: String, required: true },
    }],
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessProject', default: null },
    projectName: { type: String, default: '', trim: true },
    taskIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'BusinessProjectTask' }],
    completedWork: { type: String, default: '', trim: true, maxlength: 5000 },
    blockers: { type: String, default: '', trim: true, maxlength: 3000 },
    nextPlan: { type: String, default: '', trim: true, maxlength: 3000 },
    hoursWorked: { type: Number, min: 0, max: 24, default: 0 },
  },
  { timestamps: true },
);

developmentDailyReportSchema.index({ communityKey: 1, user: 1, reportDate: 1 }, { unique: true });

module.exports = mongoose.model('DevelopmentDailyReport', developmentDailyReportSchema);
