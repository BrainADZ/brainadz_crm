const mongoose = require('mongoose');
const { ACTIONS } = require('../config/accessControl');

const userPermissionOverrideSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    resource: { type: String, required: true, trim: true },
    allowActions: [{ type: String, enum: ACTIONS }],
    denyActions: [{ type: String, enum: ACTIONS }],
    reason: { type: String, default: '', trim: true },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

userPermissionOverrideSchema.index({ userId: 1, resource: 1 }, { unique: true });
module.exports = mongoose.model('UserPermissionOverride', userPermissionOverrideSchema);
