const Notification = require('../models/Notification');

const createNotification = async (payload) => {
  const communityKey = String(payload.communityKey || '').trim();
  const dedupeKey = String(payload.dedupeKey || '').trim();
  const notification = {
    communityKey,
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
  };

  try {
    if (!dedupeKey) return await Notification.create(notification);

    return await Notification.findOneAndUpdate(
      { communityKey, dedupeKey },
      {
        $setOnInsert: {
          ...notification,
          dedupeKey,
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      },
    );
  } catch (error) {
    if (error?.code === 11000 && dedupeKey) {
      try {
        return await Notification.findOne({ communityKey, dedupeKey });
      } catch (lookupError) {
        console.error('Error finding deduplicated notification:', lookupError.message);
      }
    }
    console.error('Error creating notification:', error.message);
    return null;
  }
};

module.exports = {
  createNotification,
};
