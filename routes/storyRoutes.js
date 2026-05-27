const express = require('express');
const router = express.Router();
const { createStory, getStoriesFeed, viewStory, reactToStory, deleteStory } = require('../controllers/storyController');
const { protect } = require('../middleware/authMiddleware');
const { uploadStory } = require('../middleware/uploadMiddleware');

router.use(protect);

router.post('/', uploadStory, createStory);
router.get('/feed', getStoriesFeed);
router.put('/:id/view', viewStory);
router.post('/:id/react', reactToStory);
router.delete('/:id', deleteStory);

module.exports = router;