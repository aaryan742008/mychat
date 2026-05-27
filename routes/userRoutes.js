const express = require('express');
const router = express.Router();
const {
  getUser, searchUsers, updateProfile, uploadAvatar, uploadCover,
  followUser, sendFriendRequest, respondFriendRequest, blockUser, getFollowers, getFollowing,
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const { uploadAvatar: avatarUpload, uploadCover: coverUpload } = require('../middleware/uploadMiddleware');

router.use(protect);

router.get('/search', searchUsers);
router.get('/:id', getUser);
router.put('/profile', updateProfile);
router.put('/avatar', avatarUpload, uploadAvatar);
router.put('/cover', coverUpload, uploadCover);
router.put('/follow/:id', followUser);
router.post('/friend-request/:id', sendFriendRequest);
router.put('/friend-request/:id', respondFriendRequest);
router.put('/block/:id', blockUser);
router.get('/:id/followers', getFollowers);
router.get('/:id/following', getFollowing);

module.exports = router;