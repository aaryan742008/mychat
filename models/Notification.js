const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: ['like', 'comment', 'friend_request', 'friend_accept', 'message', 'story_view', 'story_reaction', 'reel_like', 'mention', 'call'],
    required: true,
  },
  content: { type: String, default: '' },
  referenceId: { type: mongoose.Schema.Types.ObjectId },
  referenceType: { type: String },
  isRead: { type: Boolean, default: false },
}, { timestamps: true });

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);