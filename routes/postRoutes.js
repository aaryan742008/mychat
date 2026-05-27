const express = require('express');
const router = express.Router();
const {
  createPost, getFeed, getPost, deletePost, likePost, savePost, getUserPosts, getSavedPosts,
} = require('../controllers/postController');
const { protect } = require('../middleware/authMiddleware');
const { uploadPost } = require('../middleware/uploadMiddleware');

router.use(protect);

router.post('/', uploadPost, createPost);
router.get('/feed', getFeed);
router.get('/saved', getSavedPosts);
router.get('/user/:id', getUserPosts);
router.get('/:id', getPost);
router.delete('/:id', deletePost);
router.put('/:id/like', likePost);
router.put('/:id/save', savePost);

module.exports = router;