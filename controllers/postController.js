const Post = require('../models/Post');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { deleteMedia } = require('../config/cloudinary');
const APIFeatures = require('../utils/apiFeatures');

exports.createPost = async (req, res, next) => {
  try {
    const { caption, hashtags, location } = req.body;

    const postData = {
      user: req.user._id,
      caption,
      location,
      hashtags: hashtags ? JSON.parse(hashtags) : [],
    };

    if (req.file) {
      postData.mediaUrl = req.file.path;
      postData.mediaPublicId = req.file.filename;
      postData.mediaType = req.file.mimetype.startsWith('video') ? 'video' : 'image';
    }

    const post = await Post.create(postData);
    await User.findByIdAndUpdate(req.user._id, { $inc: { postsCount: 1 } });
    await post.populate('user', 'username displayName avatar isVerified');

    res.status(201).json({ success: true, post });
  } catch (error) { next(error); }
};

exports.getFeed = async (req, res, next) => {
  try {
    const currentUser = await User.findById(req.user._id);
    const following = [...currentUser.following, req.user._id];

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const posts = await Post.find({ user: { $in: following }, visibility: { $ne: 'private' } })
      .populate('user', 'username displayName avatar isVerified isOnline')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({ success: true, posts, page, hasMore: posts.length === limit });
  } catch (error) { next(error); }
};

exports.getPost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id).populate('user', 'username displayName avatar isVerified');
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
    res.json({ success: true, post });
  } catch (error) { next(error); }
};

exports.deletePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
    if (post.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    if (post.mediaPublicId) await deleteMedia(post.mediaPublicId, post.mediaType === 'video' ? 'video' : 'image');
    await post.deleteOne();
    await User.findByIdAndUpdate(req.user._id, { $inc: { postsCount: -1 } });
    res.json({ success: true, message: 'Post deleted' });
  } catch (error) { next(error); }
};

exports.likePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id).populate('user', 'socketId displayName');
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    const isLiked = post.likes.includes(req.user._id);

    if (isLiked) {
      post.likes.pull(req.user._id);
      post.likesCount = Math.max(0, post.likesCount - 1);
    } else {
      post.likes.push(req.user._id);
      post.likesCount += 1;

      if (post.user._id.toString() !== req.user._id.toString()) {
        await Notification.create({
          recipient: post.user._id,
          actor: req.user._id,
          type: 'like',
          content: `${req.user.displayName} liked your post`,
          referenceId: post._id,
          referenceType: 'Post',
        });

        const io = req.app.get('io');
        if (post.user.socketId) {
          io.to(post.user.socketId).emit('notification', { type: 'like', postId: post._id, actor: req.user });
        }
      }
    }

    await post.save();
    res.json({ success: true, isLiked: !isLiked, likesCount: post.likesCount });
  } catch (error) { next(error); }
};

exports.savePost = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const isSaved = user.savedPosts.includes(req.params.id);

    if (isSaved) {
      user.savedPosts.pull(req.params.id);
      await Post.findByIdAndUpdate(req.params.id, { $inc: { savesCount: -1 } });
    } else {
      user.savedPosts.push(req.params.id);
      await Post.findByIdAndUpdate(req.params.id, { $inc: { savesCount: 1 } });
    }

    await user.save({ validateBeforeSave: false });
    res.json({ success: true, isSaved: !isSaved });
  } catch (error) { next(error); }
};

exports.getUserPosts = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    const posts = await Post.find({ user: req.params.id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({ success: true, posts, hasMore: posts.length === limit });
  } catch (error) { next(error); }
};

exports.getSavedPosts = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate({
      path: 'savedPosts',
      populate: { path: 'user', select: 'username displayName avatar' },
    });
    res.json({ success: true, posts: user.savedPosts });
  } catch (error) { next(error); }
};