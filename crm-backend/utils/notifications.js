const Notification = require('../models/Notification');

const createNotification = async (payload) => {
  try {
    return await Notification.create({
      recipientRole: payload.recipientRole,
      recipientUser: payload.recipientUser || null,
      actorUser: payload.actorUser || null,
      actorName: payload.actorName || 'System',
      actorRole: payload.actorRole || '',
      type: payload.type || 'general',
      title: payload.title,
      message: payload.message || '',
      link: payload.link || '',
      meta: payload.meta || {},
    });
  } catch (error) {
    console.error('Error creating notification:', error.message);
    return null;
  }
};

module.exports = {
  createNotification,
};
