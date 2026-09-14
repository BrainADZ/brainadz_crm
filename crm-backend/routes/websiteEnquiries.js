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

router.get('/options', requirePermission('website_enquiries', 'view'), getOptions);
router.get(
  '/',
  requirePermission('website_enquiries', 'view'),
  applyAccessScope('website_enquiries'),
  listEnquiries,
);
router.post('/', requirePermission('website_enquiries', 'create'), createEnquiry);
router.patch(
  '/assign',
  requirePermission('website_enquiries', 'assign'),
  applyAccessScope('website_enquiries'),
  assignEnquiries,
);
router.patch(
  '/:id/action',
  requirePermission('website_enquiries', 'update'),
  applyAccessScope('website_enquiries'),
  updateAction,
);

module.exports = router;
