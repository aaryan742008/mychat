const CallLog = require('../models/CallLog');
const User = require('../models/User');

exports.initiateCall = async (req, res, next) => {
  try {
    const { receiverId, type } = req.body;
    const receiver = await User.findById(receiverId).select('socketId displayName avatar');
    if (!receiver) return res.status(404).json({ success: false, message: 'User not found' });

    const callLog = await CallLog.create({
      caller: req.user._id,
      receiver: receiverId,
      type,
      status: 'missed',
      startedAt: new Date(),
    });

    // Emit call event to receiver
    const io = req.app.get('io');
    if (receiver.socketId) {
      io.to(receiver.socketId).emit('incoming_call', {
        callId: callLog._id,
        caller: { _id: req.user._id, displayName: req.user.displayName, avatar: req.user.avatar },
        type,
      });
    }

    res.json({ success: true, callId: callLog._id, message: 'Call initiated' });
  } catch (error) { next(error); }
};

exports.getCallHistory = async (req, res, next) => {
  try {
    const calls = await CallLog.find({
      $or: [{ caller: req.user._id }, { receiver: req.user._id }],
    })
      .populate('caller', 'username displayName avatar')
      .populate('receiver', 'username displayName avatar')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ success: true, calls });
  } catch (error) { next(error); }
};

exports.updateCallStatus = async (req, res, next) => {
  try {
    const { status, duration } = req.body;
    const call = await CallLog.findByIdAndUpdate(
      req.params.id,
      { status, duration, endedAt: new Date() },
      { new: true }
    );
    res.json({ success: true, call });
  } catch (error) { next(error); }
};