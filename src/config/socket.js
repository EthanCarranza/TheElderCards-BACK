const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("../api/models/user");

let io;

const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.NODE_ENV === "production" 
        ? ["https://the-elder-cards-front.vercel.app"] 
        : ["http://localhost:5173", "http://localhost:3000"],
      credentials: true,
    },
  });

  // Middleware de autenticación para WebSockets
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error("Token de autenticación requerido"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select("-password");
      
      if (!user) {
        return next(new Error("Usuario no encontrado"));
      }

      socket.userId = user._id.toString();
      socket.user = user;
      next();
    } catch (error) {
      console.error("Error de autenticación WebSocket:", error);
      next(new Error("Token inválido"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`Usuario conectado: ${socket.user.username} (${socket.userId})`);
    
    // Unirse a una sala personal para recibir notificaciones
    socket.join(`user_${socket.userId}`);

    // Evento para solicitar conteo inicial de notificaciones
    socket.on("request_initial_counts", async () => {
      try {
        const Message = require("../api/models/message");
        const Friendship = require("../api/models/friendship");

        const [unreadCount, pendingCount] = await Promise.all([
          Message.getUnreadCount(socket.userId),
          Friendship.countDocuments({ 
            recipient: socket.userId, 
            status: "pending" 
          })
        ]);

        socket.emit("notification_counts", {
          unreadCount,
          pendingCount,
        });
      } catch (error) {
        console.error("Error al obtener conteos iniciales:", error);
        socket.emit("notification_error", "Error al cargar notificaciones");
      }
    });

    socket.on("disconnect", () => {
      console.log(`Usuario desconectado: ${socket.user.username}`);
    });
  });

  return io;
};

const getSocketIO = () => {
  if (!io) {
    throw new Error("Socket.IO no ha sido inicializado");
  }
  return io;
};

// Funciones de utilidad para emitir eventos
const emitToUser = (userId, event, data) => {
  if (io) {
    io.to(`user_${userId}`).emit(event, data);
  }
};

const emitUnreadCountUpdate = (userId, unreadCount) => {
  emitToUser(userId, "unread_count_updated", { unreadCount });
};

const emitPendingRequestUpdate = (userId, pendingCount) => {
  emitToUser(userId, "pending_requests_updated", { pendingCount });
};

const emitNewMessage = (recipientId, message) => {
  emitToUser(recipientId, "new_message", message);
};

const emitNewFriendRequest = (recipientId, request) => {
  emitToUser(recipientId, "new_friend_request", request);
};

const emitFriendRequestResponse = (requesterId, response) => {
  emitToUser(requesterId, "friend_request_response", response);
};

module.exports = {
  initializeSocket,
  getSocketIO,
  emitToUser,
  emitUnreadCountUpdate,
  emitPendingRequestUpdate,
  emitNewMessage,
  emitNewFriendRequest,
  emitFriendRequestResponse,
};