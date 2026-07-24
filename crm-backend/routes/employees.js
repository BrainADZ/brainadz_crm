const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');
const { CRM_ROLE_KEYS, COMMUNITY_KEYS } = require('../config/accessControl');
const OfficeStructure = require('../models/OfficeStructure');

const router = express.Router();

const requireSuperAdmin = (req, res) => {
  if (req.user.crmRole === 'super_admin') return false;
  res.status(403).json({ message: 'Access denied: Super Admin only' });
  return true;
};

const normalizeList = (value) => {
  if (Array.isArray(value)) return value.map(String);
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const normalizeCommunities = (value) => {
  const requested = value === undefined ? [] : normalizeList(value);
  return [...new Set(requested.filter((key) => COMMUNITY_KEYS.includes(key)))];
};

const normalizeIndianPhone = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  const localNumber = digits.startsWith('91') && digits.length === 12 ? digits.slice(2) : digits;
  return /^\d{10}$/.test(localNumber) ? `+91${localNumber}` : '';
};

const publicEmployee = (employee) => ({
  _id: employee._id,
  name: employee.name,
  email: employee.email,
  role: employee.role,
  crmRole: employee.crmRole || employee.role,
  roleKey:
    employee.crmRole && employee.crmRole !== 'employee'
      ? employee.crmRole
      : employee.roleKey || employee.role,
  department: employee.officeModule || employee.department || '',
  officeModule: employee.officeModule || employee.department || '',
  team: employee.team || '',
  permissions: employee.permissions || [],
  communities: employee.communities || [],
  accountStatus: employee.accountStatus || 'active',
  employeeId: employee.employeeId || '',
  phone: employee.phone || '',
  address: employee.address || '',
  imageUrl: employee.imageUrl || '',
  position: employee.position || '',
  lastLoginAt: employee.lastLoginAt || null,
  createdAt: employee.createdAt || null,
  updatedAt: employee.updatedAt || null,
});

// Set up multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png/;
    const mimetype = allowedTypes.test(file.mimetype);
    const extname = allowedTypes.test(file.originalname.split('.').pop().toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images are allowed (jpeg, jpg, png)'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB file size limit
});

// Get all employees
router.get('/', authMiddleware, async (req, res) => {
  try {
    if (requireSuperAdmin(req, res)) return;

    const employees = await User.find({ role: 'employee', isDeleted: { $ne: true } })
      .select('-password -securityAnswerHash')
      .sort({ createdAt: -1 });
    res.json(employees.map(publicEmployee));
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Register new employee
router.post('/register', authMiddleware, upload.single('image'), async (req, res) => {
  const {
    name,
    email,
    password,
    phone,
    address,
    position,
    team,
    crmRole,
    permissions,
    communities,
  } = req.body;

  try {
    if (requireSuperAdmin(req, res)) return;

    if (crmRole === 'super_admin' || (crmRole && !CRM_ROLE_KEYS.includes(crmRole))) {
      return res.status(400).json({ message: 'Invalid employee CRM role' });
    }

    const selectedCommunities = normalizeCommunities(communities);
    if (!selectedCommunities.length)
      return res.status(400).json({ message: 'Select at least one community' });
    if (!team || !(await OfficeStructure.exists({ type: 'team', name: team.trim() })))
      return res.status(400).json({ message: 'Select a valid team' });
    if (
      !position ||
      !(await OfficeStructure.exists({
        type: 'designation',
        name: position.trim(),
        teamName: team.trim(),
      }))
    )
      return res.status(400).json({ message: 'Select a valid designation for this team' });
    const normalizedPhone = normalizeIndianPhone(phone);
    if (!normalizedPhone)
      return res
        .status(400)
        .json({ message: 'Phone number must contain exactly 10 digits after +91' });

    // Validate input
    if (!name || !email || !password || !phone || !address || !position) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if the email already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already in use' });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new employee
    const newEmployee = new User({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: 'employee',
      userType: 'employee',
      roleKey: crmRole || 'employee',
      crmRole: crmRole || 'employee',
      department: '',
      officeModule: '',
      team: team?.trim() || '',
      permissions: Array.isArray(permissions)
        ? permissions
        : String(permissions || '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
      communities: selectedCommunities,
      primaryCommunity: selectedCommunities[0],
      accountStatus: 'active',
      phone: normalizedPhone,
      address: address.trim(),
      imageUrl: req.file ? req.file.path : null,
      position: position.trim(),
      passwordChangedAt: new Date(),
    });

    await newEmployee.save();
    res
      .status(201)
      .json({ message: 'Employee registered successfully', employee: publicEmployee(newEmployee) });
  } catch (err) {
    console.error('Error in employee registration:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Delete an employee by ID
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    if (requireSuperAdmin(req, res)) return;

    const employeeId = req.params.id;

    console.log(`Received request to delete employee with ID: ${employeeId}`); // Log the ID to check

    const employee = await User.findById(employeeId);

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    employee.isDeleted = true;
    employee.deletedAt = new Date();
    employee.accountStatus = 'inactive';
    employee.sessionVersion = (employee.sessionVersion || 0) + 1;
    await employee.save();
    res.status(200).json({ message: 'Employee deactivated successfully' });
  } catch (err) {
    console.error('Error during deletion:', err.message);
    res.status(500).send('Server error');
  }
});

// Update an employee by ID
router.put('/:id', authMiddleware, upload.single('image'), async (req, res) => {
  const {
    name,
    email,
    password,
    phone,
    address,
    position,
    team,
    crmRole,
    permissions,
    communities,
  } = req.body;

  try {
    if (requireSuperAdmin(req, res)) return;

    if (crmRole === 'super_admin' || (crmRole && !CRM_ROLE_KEYS.includes(crmRole))) {
      return res.status(400).json({ message: 'Invalid employee CRM role' });
    }

    // Find the employee by ID
    const employee = await User.findById(req.params.id);

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    if (employee.role !== 'employee') {
      return res.status(400).json({ message: 'Only employee users can be updated here' });
    }

    if (email) {
      const normalizedEmail = email.trim().toLowerCase();
      const existingUser = await User.findOne({
        email: normalizedEmail,
        _id: { $ne: employee._id },
      });

      if (existingUser) {
        return res.status(400).json({ message: 'Email already in use' });
      }

      employee.email = normalizedEmail;
    }

    // Update employee fields
    employee.name = name?.trim() || employee.name;
    if (phone) {
      const normalizedPhone = normalizeIndianPhone(phone);
      if (!normalizedPhone)
        return res
          .status(400)
          .json({ message: 'Phone number must contain exactly 10 digits after +91' });
      employee.phone = normalizedPhone;
    }
    employee.address = address?.trim() || employee.address;
    employee.position = position?.trim() || employee.position;
    const nextTeam = team?.trim() || employee.team;
    const nextDesignation = position?.trim() || employee.position;
    if (!(await OfficeStructure.exists({ type: 'team', name: nextTeam })))
      return res.status(400).json({ message: 'Select a valid team' });
    if (
      !(await OfficeStructure.exists({
        type: 'designation',
        name: nextDesignation,
        teamName: nextTeam,
      }))
    )
      return res.status(400).json({ message: 'Select a valid designation for this team' });
    employee.department = '';
    employee.officeModule = '';
    employee.team = nextTeam;
    employee.position = nextDesignation;
    if (crmRole) {
      employee.crmRole = crmRole;
      employee.roleKey = crmRole;
    }
    if (permissions !== undefined) {
      employee.permissions = Array.isArray(permissions)
        ? permissions
        : String(permissions || '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
    }
    if (communities !== undefined) {
      const selectedCommunities = normalizeCommunities(communities);
      if (!selectedCommunities.length)
        return res.status(400).json({ message: 'Select at least one community' });
      employee.communities = selectedCommunities;
      if (!selectedCommunities.includes(employee.primaryCommunity))
        employee.primaryCommunity = selectedCommunities[0];
    }
    employee.sessionVersion = (employee.sessionVersion || 0) + 1;

    if (password) {
      if (password.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters' });
      }
      // If a new password is provided, hash it
      const salt = await bcrypt.genSalt(10);
      employee.password = await bcrypt.hash(password, salt);
      employee.passwordChangedAt = new Date();
    }

    if (req.file) {
      // If a new image is uploaded, update the imageUrl
      employee.imageUrl = req.file.path.replace(/\\/g, '/'); // Ensure correct file path format
    }

    await employee.save();
    res
      .status(200)
      .json({ message: 'Employee updated successfully', employee: publicEmployee(employee) });
  } catch (err) {
    console.error('Error updating employee:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});
// Get logged-in employee details
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const employee = await User.findById(req.user.id).select('-password -securityAnswerHash'); // Exclude sensitive fields
    if (!employee || employee.role !== 'employee') {
      return res.status(404).json({ message: 'Employee not found' });
    }
    res.json(publicEmployee(employee));
  } catch (err) {
    console.error('Error fetching employee details:', err);
    res.status(500).send('Server error');
  }
});

module.exports = router;
