const Story = require('../models/Story');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { deleteMedia } = require('../config/cloudinary');

exports.createStory = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Media file required' });

    const story = await Story.create({
      user: req.user._id,
      mediaUrl: req.file.path,
      mediaPublicId: req.file.filename,
      mediaType: req.file.mimetype.startsWith('video') ? 'video' : 'image',
      caption: req.body.caption || '',
    });

    await story.populate('user', 'username displayName avatar');
    res.status(201).json({ success: true, story });
  } catch (error) { next(error); }
};

exports.getStoriesFeed = async (req, res, next) => {
  try {
    const currentUser = await User.findById(req.user._id);
    const following = [...currentUser.following, req.user._id];

    const stories = await Story.find({
      user: { $in: following },
      expiresAt: { $gt: new Date() },
    })
      .populate('user', 'username displayName avatar isVerified')
      .sort({ createdAt: -1 });

    // Group by user
    const grouped = {};
    stories.forEach(story => {
      const uid = story.user._id.toString();
      if (!grouped[uid]) grouped[uid] = { user: story.user, stories: [] };
      grouped[uid].stories.push(story);
    });

    res.json({ success: true, storyGroups: Object.values(grouped) });
  } catch (error) { next(error); }
};

exports.viewStory = async (req, res, next) => {
  try {
    const story = await Story.findById(req.params.id).populate('user', 'socketId displayName');
    if (!story) return res.status(404).json({ success: false, message: 'Story not found or expired' });

    if (!story.viewers.includes(req.user._id)) {
      story.viewers.push(req.user._id);
      await story.save();

      if (story.user._id.toString() !== req.user._id.toString() && story.user.socketId) {
        const io = req.app.get('io');
        io.to(story.user.socketId).emit('story_viewed', { storyId: story._id, viewer: req.user });
      }
    }

    res.json({ success: true, viewersCount: story.viewers.length });
  } catch (error) { next(error); }
};

exports.reactToStory = async (req, res, next) => {
  try {
    const { emoji } = req.body;
    const story = await Story.findById(req.params.id).populate('user', 'socketId');
    if (!story) return res.status(404).json({ success: false, message: 'Story not found' });

    story.reactions.push({ user: req.user._id, emoji });
    await story.save();

    if (story.user.socketId) {
      const io = req.app.get('io');
      io.to(story.user.socketId).emit('story_reaction', { storyId: story._id, reaction: { user: req.user, emoji } });
    }

    res.json({ success: true, message: 'Reaction added' });
  } catch (error) { next(error); }
};

exports.deleteStory = async (req, res, next) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) return res.status(404).json({ success: false, message: 'Story not found' });
    if (story.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (story.mediaPublicId) await deleteMedia(story.mediaPublicId, story.mediaType === 'video' ? 'video' : 'image');
    await story.deleteOne();
    res.json({ success: true, message: 'Story deleted' });
  } catch (error) { next(error); }
};
