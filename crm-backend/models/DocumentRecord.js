const mongoose = require('mongoose');

const documentRecordSchema = new mongoose.Schema(
  {
    communityKey: { type: String, required: true, default: 'live', index: true },
    officeModule: { type: String, default: '', trim: true, index: true },
    team: { type: String, default: '', trim: true, index: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessProject', default: null },
    ownerUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    linkedUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    name: { type: String, required: true, trim: true },
    type: { type: String, default: 'Proposal', trim: true },
    project: { type: String, default: 'All Projects', trim: true },
    owner: { type: String, default: 'Admin', trim: true },
    access: {
      type: String,
      enum: ['Internal', 'Client View', 'Restricted'],
      default: 'Internal',
    },
    visibility: {
      type: String,
      enum: [
        'internal',
        'department',
        'team',
        'project_members',
        'client_visible',
        'vendor_visible',
        'private',
      ],
      default: 'internal',
    },
    approved: { type: Boolean, default: false },
    fileUrl: { type: String, default: '', trim: true },
    notes: { type: String, default: '', trim: true },
    uploadedAt: { type: Date, default: Date.now },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
  },
);

documentRecordSchema.index({ communityKey: 1, visibility: 1, projectId: 1 });

module.exports = mongoose.model('DocumentRecord', documentRecordSchema);
