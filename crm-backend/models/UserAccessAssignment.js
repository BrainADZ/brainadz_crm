const mongoose = require('mongoose');
const { DATA_SCOPES, ACTIONS } = require('../config/accessControl');

const overrideSchema = new mongoose.Schema(
  {
    resource: { type: String, required: true, trim: true },
    allow: [{ type: String, enum: ACTIONS }],
    deny: [{ type: String, enum: ACTIONS }],
  },
  { _id: false },
);

const userAccessAssignmentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RolePermission',
      required: true,
      index: true,
    },
    businessUnitIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'BusinessUnit' }],
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
      index: true,
    },
    teamIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'OrganizationTeam' }],
    dataScope: { type: String, enum: DATA_SCOPES, required: true, default: 'ASSIGNED' },
    modulePermissionOverrides: { type: [overrideSchema], default: [] },
    isPrimary: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['active', 'inactive', 'scheduled', 'expired'],
      default: 'active',
      index: true,
    },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

userAccessAssignmentSchema.index({ userId: 1, status: 1, startDate: 1, endDate: 1 });
module.exports = mongoose.model('UserAccessAssignment', userAccessAssignmentSchema);
