const mongoose = require('mongoose');

const officeStructureSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['module', 'team', 'designation'],
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    moduleName: {
      type: String,
      default: '',
      trim: true,
    },
    teamName: {
      type: String,
      default: '',
      trim: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
  },
);

officeStructureSchema.index({ type: 1, name: 1, teamName: 1 }, { unique: true });

module.exports = mongoose.model('OfficeStructure', officeStructureSchema);
