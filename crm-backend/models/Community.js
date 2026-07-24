const mongoose = require('mongoose');

const communitySchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true, lowercase: true },
    name: { type: String, required: true, unique: true, trim: true },
    universal: { type: Boolean, default: true },
    locked: { type: Boolean, default: true },
    active: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Community', communitySchema);
