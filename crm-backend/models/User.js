const mongoose = require('mongoose');
const {
  ACTIONS,
  SCOPES,
  USER_TYPES,
  ACCOUNT_STATUSES,
  COMMUNITY_KEYS,
} = require('../config/accessControl');

const permissionOverrideSchema = new mongoose.Schema(
  {
    resource: { type: String, required: true, trim: true },
    actions: [{ type: String, enum: ACTIONS }],
    scope: { type: String, enum: SCOPES, default: 'none' },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    password: { type: String, select: false },
    role: { type: String, enum: ['admin', 'employee'], default: 'employee' },
    userType: { type: String, enum: USER_TYPES, default: 'employee', index: true },
    roleKey: { type: String, default: 'employee', trim: true, lowercase: true, index: true },
    crmRole: { type: String, default: 'employee', trim: true, lowercase: true },
    communities: [{ type: String, enum: COMMUNITY_KEYS }],
    primaryCommunity: { type: String, enum: COMMUNITY_KEYS },
    accountStatus: { type: String, enum: ACCOUNT_STATUSES, default: 'active', index: true },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    sessionVersion: { type: Number, default: 0 },
    accessAssignmentsInitialized: { type: Boolean, default: false, index: true },

    department: { type: String, default: 'Sales', trim: true },
    officeModule: { type: String, default: 'Sales', trim: true, index: true },
    team: { type: String, default: 'Sales Team', trim: true, index: true },
    secondaryTeam: { type: String, default: '', trim: true },
    reportingManager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    employeeId: { type: String, trim: true, uppercase: true },
    employmentType: {
      type: String,
      enum: ['full_time', 'part_time', 'intern', 'contract', 'consultant'],
      default: 'full_time',
    },
    joiningDate: { type: Date, default: null },
    workLocation: { type: String, default: '', trim: true },
    notes: { type: String, default: '', trim: true },
    emergencyContact: { type: String, default: '', trim: true },

    clientCompany: { type: String, default: '', trim: true },
    vendorCompany: { type: String, default: '', trim: true },
    vendorType: { type: String, default: '', trim: true },
    serviceType: { type: String, default: '', trim: true },
    linkedClient: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', default: null },
    linkedProjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'BusinessProject' }],
    linkedTasks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'BusinessProjectTask' }],
    assignedManager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    contractStartDate: { type: Date, default: null },
    contractEndDate: { type: Date, default: null },
    gstTaxDetails: { type: String, default: '', trim: true },

    permissionOverrides: {
      allow: { type: [permissionOverrideSchema], default: [] },
      deny: { type: [permissionOverrideSchema], default: [] },
    },
    permissions: [{ type: String }],
    legacyPermissions: [{ type: String }],

    phone: { type: String, trim: true },
    mobile: { type: String, trim: true },
    address: String,
    street: String,
    city: String,
    stateProvince: String,
    postalCode: String,
    country: { type: String, default: 'India' },
    imageUrl: String,
    position: String,
    alias: String,
    nickname: String,
    timezone: { type: String, default: '(GMT+05:30) India Standard Time (Asia/Kolkata)' },
    locale: { type: String, default: 'English (India)' },
    language: { type: String, default: 'English' },
    emailEncoding: { type: String, default: 'Unicode (UTF-8)' },
    securityQuestion: { type: String, default: 'In what city were you born?' },
    securityAnswerHash: { type: String, select: false },
    securityAnswerUpdatedAt: Date,
    lastLoginAt: Date,
    passwordChangedAt: Date,
    invitationSentAt: Date,
    loginHistory: [
      {
        loginTime: { type: Date, default: Date.now },
        sourceIp: String,
        loginType: { type: String, default: 'Application' },
        loginSubtype: { type: String, default: 'UI Username-Password' },
        status: String,
        application: { type: String, default: 'Browser' },
        loginUrl: String,
        location: String,
        userAgent: String,
      },
    ],
  },
  { timestamps: true },
);

userSchema.index({ employeeId: 1 }, { unique: true, sparse: true });
userSchema.index({ communities: 1, accountStatus: 1 });
userSchema.index({ reportingManager: 1, isDeleted: 1 });

userSchema.pre('validate', function synchronizeLegacyRole(next) {
  if (this.roleKey === 'employee' && this.crmRole && this.crmRole !== 'employee')
    this.roleKey = this.crmRole;
  if (this.isModified('crmRole') && !this.isModified('roleKey')) this.roleKey = this.crmRole;
  if (this.isModified('roleKey') || !this.crmRole) this.crmRole = this.roleKey;
  if (this.roleKey === 'super_admin') {
    this.role = 'admin';
    this.userType = 'employee';
    this.communities = COMMUNITY_KEYS;
    this.primaryCommunity = this.primaryCommunity || COMMUNITY_KEYS[0];
    this.accountStatus = 'active';
  }
  next();
});

module.exports = mongoose.model('User', userSchema);
