const express = require('express');
const {
  assignEnquiries,
  createEnquiry,
  createPublicEnquiry,
  getOptions,
  listEnquiries,
  updateAction,
} = require('../controllers/websiteEnquiryController');
const authMiddleware = require('../middleware/authMiddleware');
const authenticateWebsiteIngestion = require('../middleware/websiteIngestionAuth');
const {
  applyAccessScope,
  loadAuthorization,
  requirePermission,
} = require('../middleware/authorization');

const router = express.Router();

router.post('/public', authenticateWebsiteIngestion, createPublicEnquiry);

router.use(authMiddleware, loadAuthorization);

router.get('/options', requirePermission('communication', 'view'), getOptions);
router.get(
  '/',
  requirePermission('communication', 'view'),
  applyAccessScope('communication'),
  listEnquiries,
);
router.post('/', requirePermission('communication', 'create'), createEnquiry);
router.patch(
  '/assign',
  requirePermission('communication', 'assign'),
  applyAccessScope('communication'),
  assignEnquiries,
);
router.patch(
  '/:id/action',
  requirePermission('communication', 'update'),
  applyAccessScope('communication'),
  updateAction,
);

module.exports = router;
