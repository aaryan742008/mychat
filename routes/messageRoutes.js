const express = require('express');
const router = express.Router();
const { sendMessage, getMessages, deleteMessage, reactToMessage } = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');
const { uploadMessage } = require('../middleware/uploadMiddleware');

router.use(protect);

router.post('/:chatId', uploadMessage, sendMessage);
router.get('/:chatId', getMessages);
router.delete('/:id', deleteMessage);
router.post('/:id/react', reactToMessage);

module.exports = router;