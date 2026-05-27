const Message = require('../models/Message');
const Chat = require('../models/Chat');
const User = require('../models/User');
const Notification = require('../models/Notification');

exports.sendMessage = async (req, res, next) => {
  try {
    const { content, type, replyTo, replyPreview } = req.body;
    const { chatId } = req.params;

    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ success: false, message: 'Chat not found' });
    if (!chat.participants.includes(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Not a participant of this chat' });
    }

    const messageData = {
      chat: chatId,
      sender: req.user._id,
      content: content || '',
      type: type || 'text',
      replyTo,
      replyPreview,
    };

    if (req.file) {
      messageData.mediaUrl = req.file.path;
      messageData.mediaPublicId = req.file.filename;
      messageData.type = req.file.mimetype.startsWith('video') ? 'video' : req.file.mimetype.startsWith('audio') ? 'audio' : 'image';
    }

    const message = await Message.create(messageData);
    await message.populate('sender', 'username displayName avatar');

    // Update chat last message
    await Chat.findByIdAndUpdate(chatId, {
      lastMessage: message._id,
      lastMessageTime: message.createdAt,
    });

    // Emit to chat room via socket
    const io = req.app.get('io');
    io.to(chatId).emit('message', message);

    // Send notifications to participants
    const otherParticipants = chat.participants.filter(p => p.toString() !== req.user._id.toString());
    for (const participantId of otherParticipants) {
      const participant = await User.findById(participantId).select('socketId');
      if (participant?.socketId) {
        io.to(participant.socketId).emit('notification', { type: 'message', message, chatId });
      }
    }

    res.status(201).json({ success: true, message });
  } catch (error) { next(error); }
};

exports.getMessages = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 30;
    const skip = (page - 1) * limit;

    const messages = await Message.find({ chat: chatId, isDeleted: false })
      .populate('sender', 'username displayName avatar')
      .populate('replyTo')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Mark as seen
    await Message.updateMany(
      { chat: chatId, sender: { $ne: req.user._id }, seenBy: { $ne: req.user._id } },
      { $push: { seenBy: req.user._id } }
    );

    res.json({ success: true, messages: messages.reverse(), hasMore: messages.length === limit });
  } catch (error) { next(error); }
};

exports.deleteMessage = async (req, res, next) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ success: false, message: 'Message not found' });
    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    message.isDeleted = true;
    message.content = 'This message was deleted';
    await message.save();

    const io = req.app.get('io');
    io.to(message.chat.toString()).emit('message_deleted', { messageId: message._id });

    res.json({ success: true, message: 'Message deleted' });
  } catch (error) { next(error); }
};

exports.reactToMessage = async (req, res, next) => {
  try {
    const { emoji } = req.body;
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ success: false, message: 'Message not found' });

    const existingReaction = message.reactions.find(r => r.user.toString() === req.user._id.toString());
    if (existingReaction) {
      existingReaction.emoji = emoji;
    } else {
      message.reactions.push({ user: req.user._id, emoji });
    }

    await message.save();

    const io = req.app.get('io');
    io.to(message.chat.toString()).emit('message_reaction', { messageId: message._id, reactions: message.reactions });

    res.json({ success: true, reactions: message.reactions });
  } catch (error) { next(error); }
};
