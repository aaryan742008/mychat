const mongoose = require('mongoose');

const reelSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  videoUrl: { type: String, required: true },
  videoPublicId: { type: String },
  thumbnailUrl: { type: String, default: '' },
  caption: { type: String, maxlength: 2200, default: '' },
  audioName: { type: String, default: 'Original Audio' },
  hashtags: [{ type: String }],
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  likesCount: { type: Number, default: 0 },
  commentsCount: { type: Number, default: 0 },
  sharesCount: { type: Number, default: 0 },
  viewsCount: { type: Number, default: 0 },
  savesCount: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Reel', reelSchema);