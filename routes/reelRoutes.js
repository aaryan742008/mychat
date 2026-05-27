const express = require('express');
const router = express.Router();
const { uploadReel, getReelsFeed, likeReel, incrementView, deleteReel } = require('../controllers/reelController');
const { protect } = require('../middleware/authMiddleware');
const { uploadReel: reelUpload } = require('../middleware/uploadMiddleware');

router.use(protect);

router.post('/', reelUpload, uploadReel);
router.get('/feed', getReelsFeed);
router.put('/:id/like', likeReel);
router.put('/:id/view', incrementView);
router.delete('/:id', deleteReel);

module.exports = router;