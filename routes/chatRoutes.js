const express = require('express');
const router = express.Router();
const { getOrCreateChat, getMyChats, createGroupChat, updateGroupChat } = require('../controllers/chatController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', getMyChats);
router.get('/dm/:userId', getOrCreateChat);
router.post('/group', createGroupChat);
router.put('/group/:id', updateGroupChat);

module.exports = router;