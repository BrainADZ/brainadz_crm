const mongoose = require('mongoose');

const businessUnitSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    description: { type: String, default: '', trim: true },
    status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
    legacyCommunityKey: { type: String, unique: true, sparse: true, trim: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model('BusinessUnit', businessUnitSchema);
