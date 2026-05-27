const Reel = require('../models/Reel');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { deleteMedia } = require('../config/cloudinary');

exports.uploadReel = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Video file required' });

    const reel = await Reel.create({
      user: req.user._id,
      videoUrl: req.file.path,
      videoPublicId: req.file.filename,
      caption: req.body.caption || '',
      audioName: req.body.audioName || 'Original Audio',
      hashtags: req.body.hashtags ? JSON.parse(req.body.hashtags) : [],
    });

    await reel.populate('user', 'username displayName avatar isVerified');
    res.status(201).json({ success: true, reel });
  } catch (error) { next(error); }
};

exports.getReelsFeed = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const reels = await Reel.find()
      .populate('user', 'username displayName avatar isVerified')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({ success: true, reels, hasMore: reels.length === limit });
  } catch (error) { next(error); }
};

exports.likeReel = async (req, res, next) => {
  try {
    const reel = await Reel.findById(req.params.id).populate('user', 'socketId displayName');
    if (!reel) return res.status(404).json({ success: false, message: 'Reel not found' });

    const isLiked = reel.likes.includes(req.user._id);
    if (isLiked) {
      reel.likes.pull(req.user._id);
      reel.likesCount = Math.max(0, reel.likesCount - 1);
    } else {
      reel.likes.push(req.user._id);
      reel.likesCount += 1;

      if (reel.user._id.toString() !== req.user._id.toString()) {
        await Notification.create({
          recipient: reel.user._id,
          actor: req.user._id,
          type: 'reel_like',
          content: `${req.user.displayName} liked your reel`,
          referenceId: reel._id,
          referenceType: 'Reel',
        });

        const io = req.app.get('io');
        if (reel.user.socketId) {
          io.to(reel.user.socketId).emit('notification', { type: 'reel_like', reelId: reel._id });
        }
      }
    }

    await reel.save();
    res.json({ success: true, isLiked: !isLiked, likesCount: reel.likesCount });
  } catch (error) { next(error); }
};

exports.incrementView = async (req, res, next) => {
  try {
    await Reel.findByIdAndUpdate(req.params.id, { $inc: { viewsCount: 1 } });
    res.json({ success: true });
  } catch (error) { next(error); }
};

exports.deleteReel = async (req, res, next) => {
  try {
    const reel = await Reel.findById(req.params.id);
    if (!reel) return res.status(404).json({ success: false, message: 'Reel not found' });
    if (reel.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    if (reel.videoPublicId) await deleteMedia(reel.videoPublicId, 'video');
    await reel.deleteOne();
    res.json({ success: true, message: 'Reel deleted' });
  } catch (error) { next(error); }
};