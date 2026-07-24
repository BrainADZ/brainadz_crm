const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    communityKey: { type: String, default: '', trim: true, index: true },
    recipientRole: {
      type: String,
      enum: ['admin', 'employee'],
      required: true,
    },
    recipientUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    actorUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    actorName: {
      type: String,
      default: 'System',
    },
    actorRole: {
      type: String,
      default: '',
    },
    type: {
      type: String,
      default: 'general',
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      default: '',
    },
    link: {
      type: String,
      default: '',
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

notificationSchema.index({ recipientRole: 1, recipientUser: 1, createdAt: -1 });
notificationSchema.index({ recipientRole: 1, recipientUser: 1, isRead: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
