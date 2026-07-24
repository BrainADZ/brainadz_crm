const express = require('express');
const Community = require('../models/Community');
const authMiddleware = require('../middleware/authMiddleware');
const { loadAuthorization } = require('../middleware/authorization');

const router = express.Router();
router.get('/', authMiddleware, loadAuthorization, async (req, res, next) => {
  try {
    const query =
      req.user.roleKey === 'super_admin'
        ? { active: true }
        : { active: true, key: { $in: req.user.communities } };
    res.json(await Community.find(query).sort({ createdAt: 1 }));
  } catch (error) {
    next(error);
  }
});
module.exports = router;
