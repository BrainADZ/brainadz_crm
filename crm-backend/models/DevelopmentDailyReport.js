const mongoose = require('mongoose');

const developmentDailyReportSchema = new mongoose.Schema(
  {
    communityKey: { type: String, required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reportDate: { type: String, required: true },
    taskIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'BusinessProjectTask' }],
    completedWork: { type: String, required: true, trim: true, maxlength: 5000 },
    blockers: { type: String, default: '', trim: true, maxlength: 3000 },
    nextPlan: { type: String, default: '', trim: true, maxlength: 3000 },
    hoursWorked: { type: Number, min: 0, max: 24, default: 0 },
  },
  { timestamps: true },
);

developmentDailyReportSchema.index({ communityKey: 1, user: 1, reportDate: 1 }, { unique: true });

module.exports = mongoose.model('DevelopmentDailyReport', developmentDailyReportSchema);
