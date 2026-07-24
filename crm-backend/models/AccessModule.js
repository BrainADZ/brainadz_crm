const mongoose = require('mongoose');

const accessModuleSchema = new mongoose.Schema(
  {
    moduleKey: { type: String, required: true, unique: true, trim: true, lowercase: true },
    label: { type: String, required: true, trim: true },
    resources: [{ type: String, trim: true }],
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

module.exports = mongoose.model('AccessModule', accessModuleSchema);
