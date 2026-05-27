const express = require('express');
const router = express.Router();
const { initiateCall, getCallHistory, updateCallStatus } = require('../controllers/callController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.post('/initiate', initiateCall);
router.get('/history', getCallHistory);
router.put('/:id/status', updateCallStatus);

module.exports = router;