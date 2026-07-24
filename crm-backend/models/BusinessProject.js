const mongoose = require('mongoose');

const teamMemberSchema = new mongoose.Schema(
  {
    name: { type: String, default: '', trim: true },
    email: { type: String, default: '', trim: true },
  },
  { _id: false },
);

const businessProjectSchema = new mongoose.Schema(
  {
    communityKey: { type: String, required: true, default: 'live', index: true },
    officeModule: { type: String, default: 'Projects', trim: true, index: true },
    team: { type: String, default: 'Delivery Team', trim: true, index: true },
    ownerUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    memberUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    clientUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    vendorUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    name: { type: String, required: true, trim: true },
    client: { type: String, required: true, trim: true },
    owner: { type: String, default: 'Project Manager', trim: true },
    ownerEmail: { type: String, default: '', trim: true },
    assignedTeam: [teamMemberSchema],
    visibilityUsers: [{ type: String, trim: true }],
    documentAccessUsers: [{ type: String, trim: true }],
    deadline: { type: String, default: '' },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      default: 'Medium',
    },
    stage: { type: String, default: 'Requirement Received', trim: true },
    health: {
      type: String,
      enum: ['Healthy', 'At Risk', 'Blocked', 'Closed'],
      default: 'Healthy',
    },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    progressApproved: { type: Boolean, default: false },
    notes: { type: String, default: '', trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
  },
);

businessProjectSchema.index({ communityKey: 1, officeModule: 1, team: 1, stage: 1 });

module.exports = mongoose.model('BusinessProject', businessProjectSchema);
