const express = require('express');
const Notification = require('../models/Notification');
const authMiddleware = require('../middleware/authMiddleware');
const { queueMeetingReminderProcessing } = require('../services/meetingReminderService');

const { queueFollowUpReminderProcessing } = require('../services/followUpReminderService');

const router = express.Router();

const getRecipientFilter = (user) => {
  const recipientUser = user._id || user.id;
  if (user.role === 'admin' || user.roleKey === 'super_admin' || user.crmRole === 'super_admin') {
    return {
      $or: [{ recipientRole: 'admin', recipientUser: null }, { recipientUser }],
    };
  }

  return {
    recipientUser,
  };
};

router.get('/', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      queueMeetingReminderProcessing({ employeeId: req.user._id });
    }
    queueFollowUpReminderProcessing();
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const recipientFilter = getRecipientFilter(req.user);

    const [notifications, unreadCount] = await Promise.all([
      Notification.find(recipientFilter).sort({ createdAt: -1 }).limit(limit),
      Notification.countDocuments({
        ...recipientFilter,
        isRead: false,
      }),
    ]);

    return res.json({ notifications, unreadCount });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/read-all', authMiddleware, async (req, res) => {
  try {
    const recipientFilter = getRecipientFilter(req.user);
    await Notification.updateMany(
      {
        ...recipientFilter,
        isRead: false,
      },
      {
        isRead: true,
        readAt: new Date(),
      },
    );

    return res.json({ message: 'Notifications marked as read' });
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/:id/read', authMiddleware, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        ...getRecipientFilter(req.user),
      },
      {
        isRead: true,
        readAt: new Date(),
      },
      {
        new: true,
      },
    );

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    return res.json({ notification });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/', authMiddleware, async (req, res) => {
  try {
    const result = await Notification.deleteMany(getRecipientFilter(req.user));
    return res.json({
      message: 'Notifications cleared',
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error('Error clearing notifications:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      ...getRecipientFilter(req.user),
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    return res.json({ message: 'Notification deleted' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
