const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  type: { type: String, enum: ['direct', 'group'], default: 'direct' },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  groupName: { type: String },
  groupAvatar: { type: String },
  groupAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
  lastMessageTime: { type: Date },
  isMuted: { type: Boolean, default: false },
  pinnedMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
  wallpaper: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Chat', chatSchema);