const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const User = require('../models/User');
const Community = require('../models/Community');
const RolePermission = require('../models/RolePermission');
const { COMMUNITY_KEYS, UNIVERSAL_COMMUNITIES } = require('../config/accessControl');
const { ensureAccessFoundation } = require('../services/organizationAccessService');

dotenv.config();

const seedSuperAdmin = async () => {
  const mongoUri = process.env.MONGODB_URI;
  const email = String(process.env.ADMIN_EMAIL || '')
    .trim()
    .toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || '');
  const name = String(process.env.ADMIN_NAME || 'Super Admin').trim();

  if (!mongoUri) throw new Error('MONGODB_URI is required in crm-backend/.env');
  if (!email) throw new Error('ADMIN_EMAIL is required in crm-backend/.env');
  if (password.length < 8) throw new Error('ADMIN_PASSWORD must be at least 8 characters');

  await mongoose.connect(mongoUri);

  await ensureAccessFoundation();
  await RolePermission.deleteOne({ roleKey: 'admin' });

  await Promise.all(
    UNIVERSAL_COMMUNITIES.map((community) =>
      Community.updateOne(
        { key: community.key },
        { $set: { ...community, active: true } },
        { upsert: true },
      ),
    ),
  );

  const passwordHash = await bcrypt.hash(password, 10);
  const existingUser = await User.findOne({ email });

  if (existingUser && existingUser.role !== 'admin') {
    throw new Error(`A non-admin user already exists with email ${email}`);
  }

  const user = await User.findOneAndUpdate(
    { email },
    {
      $set: {
        name,
        password: passwordHash,
        role: 'admin',
        roleKey: 'super_admin',
        crmRole: 'super_admin',
        communities: COMMUNITY_KEYS,
        primaryCommunity: 'live',
        userType: 'employee',
        accountStatus: 'active',
        permissions: [],
        passwordChangedAt: new Date(),
        sessionVersion: 0,
      },
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  );

  console.log('Super Admin seed completed successfully.');
  console.log(`Email: ${user.email}`);
  console.log(`Communities: ${COMMUNITY_KEYS.join(', ')}`);
  console.log('Password was read from ADMIN_PASSWORD and has been securely hashed.');
};

seedSuperAdmin()
  .catch((error) => {
    console.error(`Super Admin seed failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
