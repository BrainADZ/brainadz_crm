const express = require('express');
const authenticate = require('../middleware/authMiddleware');
const authenticateWebsite = require('../middleware/websiteIngestionAuth');
const { requireLiveEmployee, requireDemoAssignmentManager } = require('../services/demoRequestAccessService');
const controller = require('../controllers/demoRequestController');

const router = express.Router();

router.post('/ingest', authenticateWebsite, controller.ingestRequest);
router.patch('/ingest/:requestId', authenticateWebsite, controller.updateDelivery);
router.get('/access', authenticate, controller.checkAccess);
router.get('/', authenticate, requireLiveEmployee, controller.listRequests);
router.get('/options', authenticate, requireLiveEmployee, requireDemoAssignmentManager, controller.getAssignmentOptions);
router.patch('/:id/assign', authenticate, requireLiveEmployee, requireDemoAssignmentManager, controller.assignRequest);
router.patch('/:id', authenticate, requireLiveEmployee, controller.updateRequest);

module.exports = router;
