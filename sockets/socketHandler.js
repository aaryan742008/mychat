const jwt = require('jsonwebtoken');
const User = require('../models/User');

const onlineUsers = new Map();

const socketHandler = (io) => {
  // Auth middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication error'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      if (!user) return next(new Error('User not found'));

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.user._id.toString();

    // Set online status
    onlineUsers.set(userId, socket.id);
    await User.findByIdAndUpdate(userId, { isOnline: true, socketId: socket.id });
    io.emit('user_online', { userId });

    console.log(`✅ User connected: ${socket.user.username} [${socket.id}]`);

    // ─── CHAT ROOM ───────────────────────────────────────────────────────────
    socket.on('join_chat', (chatId) => {
      socket.join(chatId);
    });

    socket.on('leave_chat', (chatId) => {
      socket.leave(chatId);
    });

    // ─── TYPING ──────────────────────────────────────────────────────────────
    socket.on('typing', ({ chatId, isTyping }) => {
      socket.to(chatId).emit('typing', { userId, isTyping, chatId });
    });

    // ─── MESSAGE SEEN ─────────────────────────────────────────────────────────
    socket.on('message_seen', ({ chatId, messageId }) => {
      socket.to(chatId).emit('message_seen', { messageId, seenBy: userId });
    });

    // ─── CALL SIGNALING (WebRTC) ─────────────────────────────────────────────
    socket.on('call_offer', ({ targetSocketId, offer, type, callId }) => {
      io.to(targetSocketId).emit('call_offer', {
        offer,
        type,
        callId,
        caller: { _id: socket.user._id, displayName: socket.user.displayName, avatar: socket.user.avatar },
      });
    });

    socket.on('call_answer', ({ targetSocketId, answer }) => {
      io.to(targetSocketId).emit('call_answer', { answer });
    });

    socket.on('call_reject', ({ targetSocketId, callId }) => {
      io.to(targetSocketId).emit('call_rejected', { callId });
    });

    socket.on('call_end', ({ targetSocketId, callId }) => {
      io.to(targetSocketId).emit('call_ended', { callId });
    });

    socket.on('ice_candidate', ({ targetSocketId, candidate }) => {
      io.to(targetSocketId).emit('ice_candidate', { candidate });
    });

    socket.on('mute_toggle', ({ targetSocketId, isMuted }) => {
      io.to(targetSocketId).emit('mute_toggle', { isMuted });
    });

    socket.on('video_toggle', ({ targetSocketId, isVideoOn }) => {
      io.to(targetSocketId).emit('video_toggle', { isVideoOn });
    });

    // ─── STORY EVENTS ─────────────────────────────────────────────────────────
    socket.on('story_reaction', ({ targetUserId, reaction }) => {
      const targetSocketId = onlineUsers.get(targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('story_reaction', reaction);
      }
    });

    // ─── NOTIFICATIONS ────────────────────────────────────────────────────────
    socket.on('send_notification', ({ targetUserId, notification }) => {
      const targetSocketId = onlineUsers.get(targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('notification', notification);
      }
    });

    // ─── DISCONNECT ───────────────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      onlineUsers.delete(userId);
      await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: new Date(), socketId: '' });
      io.emit('user_offline', { userId });
      console.log(`❌ User disconnected: ${socket.user.username}`);
    });
  });
};

module.exports = socketHandler;
