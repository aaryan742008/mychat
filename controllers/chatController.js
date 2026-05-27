const Chat = require('../models/Chat');
const Message = require('../models/Message');
const User = require('../models/User');

exports.getOrCreateChat = async (req, res, next) => {
  try {
    const { userId } = req.params;

    let chat = await Chat.findOne({
      type: 'direct',
      participants: { $all: [req.user._id, userId], $size: 2 },
    }).populate('participants', 'username displayName avatar isOnline lastSeen');

    if (!chat) {
      chat = await Chat.create({ type: 'direct', participants: [req.user._id, userId] });
      chat = await chat.populate('participants', 'username displayName avatar isOnline lastSeen');
    }

    res.json({ success: true, chat });
  } catch (error) { next(error); }
};

exports.getMyChats = async (req, res, next) => {
  try {
    const chats = await Chat.find({ participants: req.user._id })
      .populate('participants', 'username displayName avatar isOnline lastSeen')
      .populate('lastMessage')
      .sort({ lastMessageTime: -1 });

    res.json({ success: true, chats });
  } catch (error) { next(error); }
};

exports.createGroupChat = async (req, res, next) => {
  try {
    const { groupName, participants } = req.body;
    if (!participants || participants.length < 2) {
      return res.status(400).json({ success: false, message: 'At least 2 participants required' });
    }

    const chat = await Chat.create({
      type: 'group',
      groupName,
      participants: [...participants, req.user._id],
      groupAdmin: req.user._id,
    });

    await chat.populate('participants', 'username displayName avatar');
    res.status(201).json({ success: true, chat });
  } catch (error) { next(error); }
};

exports.updateGroupChat = async (req, res, next) => {
  try {
    const { groupName } = req.body;
    const chat = await Chat.findById(req.params.id);

    if (!chat) return res.status(404).json({ success: false, message: 'Chat not found' });
    if (chat.groupAdmin.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only admin can update group' });
    }

    if (groupName) chat.groupName = groupName;
    if (req.file) {
      chat.groupAvatar = req.file.path;
    }

    await chat.save();
    res.json({ success: true, chat });
  } catch (error) { next(error); }
};