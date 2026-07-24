const mongoose = require('mongoose');

const organizationTeamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
      index: true,
    },
    businessUnitIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'BusinessUnit' }],
    isCompanyWide: { type: Boolean, default: false },
    managerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    seniorManagerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    teamLeadUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

organizationTeamSchema.index(
  { departmentId: 1, name: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } },
);
module.exports = mongoose.model('OrganizationTeam', organizationTeamSchema);
