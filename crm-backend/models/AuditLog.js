const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    action: { type: String, required: true, trim: true },
    resource: { type: String, required: true, trim: true },
    resourceId: { type: String, default: '', trim: true },
    previousValue: { type: mongoose.Schema.Types.Mixed, default: null },
    newValue: { type: mongoose.Schema.Types.Mixed, default: null },
    communityKey: { type: String, default: '', trim: true },
    ipAddress: { type: String, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

auditLogSchema.index({ targetUserId: 1, createdAt: -1 });
auditLogSchema.index({ resource: 1, resourceId: 1, createdAt: -1 });
auditLogSchema.index({ communityKey: 1, createdAt: -1 });
module.exports = mongoose.model('AuditLog', auditLogSchema);
