const { Server } = require("socket.io");
const { verificarLlave } = require("../src/utils/jwt");
const User = require("../src/api/models/user");

let io;

module.exports = (req, res) => {
  if (!res.socket.server.io) {
    console.log("Initializing Socket.IO for Vercel...");
    
    io = new Server(res.socket.server, {
      path: "/api/socket.io/",
      cors: {
        origin: "*",
        credentials: true,
      },
      transports: ['polling'],
      allowEIO3: true,
    });

    io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;

        if (!token) {
          return next(new Error("Token de autenticación requerido"));
        }

        const decoded = verificarLlave(token);
        const user = await User.findById(decoded.id).select("-password");

        if (!user) {
          return next(new Error("Usuario no encontrado"));
        }

        socket.userId = user._id.toString();
        socket.user = user;
        next();
      } catch (error) {
        next(new Error("Token inválido"));
      }
    });

    io.on("connection", (socket) => {
      console.log(`Usuario conectado: ${socket.user.username} (${socket.userId})`);

      socket.join(`user_${socket.userId}`);
      
      socket.on("request_initial_counts", async () => {
        try {
          const Message = require("../src/api/models/message");
          const Friendship = require("../src/api/models/friendship");

          const [unreadCount, pendingCount] = await Promise.all([
            Message.getUnreadCount(socket.userId),
            Friendship.countDocuments({
              recipient: socket.userId,
              status: "pending",
            }),
          ]);

          socket.emit("notification_counts", {
            unreadCount,
            pendingCount,
          });
        } catch (error) {
          socket.emit("notification_error", "Error al cargar notificaciones");
        }
      });

      socket.on("disconnect", () => {
        console.log(`Usuario desconectado: ${socket.userId}`);
      });
    });

    res.socket.server.io = io;
  }
  
  res.end();
};