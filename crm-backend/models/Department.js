const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    description: { type: String, default: '', trim: true },
    icon: { type: String, default: 'Building2', trim: true },
    status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
    isCompanyWide: { type: Boolean, default: false },
    businessUnitIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'BusinessUnit' }],
    defaultModuleIds: [{ type: String, trim: true }],
    moduleDefaultsInitialized: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

departmentSchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
module.exports = mongoose.model('Department', departmentSchema);
