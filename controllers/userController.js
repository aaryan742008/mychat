const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest');
const Notification = require('../models/Notification');
const { deleteMedia } = require('../config/cloudinary');

exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password -socketId -resetPasswordToken -resetPasswordExpire');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (error) { next(error); }
};

exports.searchUsers = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q) return res.json({ success: true, users: [] });

    const users = await User.find({
      $or: [
        { username: { $regex: q, $options: 'i' } },
        { displayName: { $regex: q, $options: 'i' } },
      ],
      _id: { $ne: req.user._id },
    }).select('username displayName avatar isOnline isVerified followersCount').limit(20);

    res.json({ success: true, users });
  } catch (error) { next(error); }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const { displayName, username, bio, website, location } = req.body;
    const updates = {};
    if (displayName) updates.displayName = displayName;
    if (username) updates.username = username;
    if (bio !== undefined) updates.bio = bio;
    if (website !== undefined) updates.website = website;
    if (location !== undefined) updates.location = location;

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true }).select('-password');
    res.json({ success: true, user });
  } catch (error) { next(error); }
};

exports.uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const user = await User.findById(req.user._id);
    if (user.avatarPublicId) await deleteMedia(user.avatarPublicId);

    user.avatar = req.file.path;
    user.avatarPublicId = req.file.filename;
    await user.save({ validateBeforeSave: false });

    res.json({ success: true, avatar: user.avatar, message: 'Avatar updated' });
  } catch (error) { next(error); }
};

exports.uploadCover = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const user = await User.findById(req.user._id);
    if (user.coverPublicId) await deleteMedia(user.coverPublicId);

    user.cover = req.file.path;
    user.coverPublicId = req.file.filename;
    await user.save({ validateBeforeSave: false });

    res.json({ success: true, cover: user.cover, message: 'Cover updated' });
  } catch (error) { next(error); }
};

exports.followUser = async (req, res, next) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot follow yourself' });
    }

    const targetUser = await User.findById(req.params.id);
    const currentUser = await User.findById(req.user._id);

    if (!targetUser) return res.status(404).json({ success: false, message: 'User not found' });

    const isFollowing = currentUser.following.includes(targetUser._id);

    if (isFollowing) {
      currentUser.following.pull(targetUser._id);
      targetUser.followers.pull(currentUser._id);
      currentUser.followingCount = Math.max(0, currentUser.followingCount - 1);
      targetUser.followersCount = Math.max(0, targetUser.followersCount - 1);
    } else {
      currentUser.following.push(targetUser._id);
      targetUser.followers.push(currentUser._id);
      currentUser.followingCount += 1;
      targetUser.followersCount += 1;

      // Create notification
      await Notification.create({
        recipient: targetUser._id,
        actor: currentUser._id,
        type: 'friend_request',
        content: `${currentUser.displayName} started following you`,
      });

      // Emit socket event
      const io = req.app.get('io');
      if (targetUser.socketId) {
        io.to(targetUser.socketId).emit('notification', { type: 'follow', actor: currentUser });
      }
    }

    await currentUser.save({ validateBeforeSave: false });
    await targetUser.save({ validateBeforeSave: false });

    res.json({ success: true, isFollowing: !isFollowing, message: isFollowing ? 'Unfollowed' : 'Followed' });
  } catch (error) { next(error); }
};

exports.sendFriendRequest = async (req, res, next) => {
  try {
    const receiver = await User.findById(req.params.id);
    if (!receiver) return res.status(404).json({ success: false, message: 'User not found' });

    const existing = await FriendRequest.findOne({ sender: req.user._id, receiver: req.params.id });
    if (existing) return res.status(400).json({ success: false, message: 'Friend request already sent' });

    const request = await FriendRequest.create({ sender: req.user._id, receiver: req.params.id });

    await Notification.create({
      recipient: receiver._id,
      actor: req.user._id,
      type: 'friend_request',
      content: `${req.user.displayName} sent you a friend request`,
      referenceId: request._id,
      referenceType: 'FriendRequest',
    });

    const io = req.app.get('io');
    if (receiver.socketId) {
      io.to(receiver.socketId).emit('friend_request', { sender: req.user });
    }

    res.json({ success: true, message: 'Friend request sent' });
  } catch (error) { next(error); }
};

exports.respondFriendRequest = async (req, res, next) => {
  try {
    const { status } = req.body; // 'accepted' or 'rejected'
    const request = await FriendRequest.findById(req.params.id).populate('sender');

    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    if (request.receiver.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    request.status = status;
    await request.save();

    if (status === 'accepted') {
      await User.findByIdAndUpdate(req.user._id, { $addToSet: { friends: request.sender._id } });
      await User.findByIdAndUpdate(request.sender._id, { $addToSet: { friends: req.user._id } });

      await Notification.create({
        recipient: request.sender._id,
        actor: req.user._id,
        type: 'friend_accept',
        content: `${req.user.displayName} accepted your friend request`,
      });

      const io = req.app.get('io');
      if (request.sender.socketId) {
        io.to(request.sender.socketId).emit('friend_accepted', { user: req.user });
      }
    }

    res.json({ success: true, message: `Friend request ${status}` });
  } catch (error) { next(error); }
};

exports.blockUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const isBlocked = user.blockedUsers.includes(req.params.id);

    if (isBlocked) {
      user.blockedUsers.pull(req.params.id);
    } else {
      user.blockedUsers.push(req.params.id);
      user.following.pull(req.params.id);
      user.friends.pull(req.params.id);
    }

    await user.save({ validateBeforeSave: false });
    res.json({ success: true, isBlocked: !isBlocked, message: isBlocked ? 'User unblocked' : 'User blocked' });
  } catch (error) { next(error); }
};

exports.getFollowers = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).populate('followers', 'username displayName avatar isOnline isVerified');
    res.json({ success: true, followers: user.followers });
  } catch (error) { next(error); }
};

exports.getFollowing = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).populate('following', 'username displayName avatar isOnline isVerified');
    res.json({ success: true, following: user.following });
  } catch (error) { next(error); }
};