const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: true,
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: true,
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxLength: 2000,
  },
  readAt: {
    type: Date,
    default: null,
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Índices para mejorar rendimiento de consultas
messageSchema.index({ sender: 1, recipient: 1, createdAt: -1 });
messageSchema.index({ recipient: 1, isRead: 1 });
messageSchema.index({ createdAt: -1 });

// Método estático para obtener conversación entre dos usuarios
messageSchema.statics.getConversation = async function (
  userId1,
  userId2,
  page = 1,
  limit = 50
) {
  const { applySafePopulateMultiple } = require("../../utils/safePopulate");

  const query = this.find({
    $or: [
      { sender: userId1, recipient: userId2 },
      { sender: userId2, recipient: userId1 },
    ],
  })
    .populate("sender", "username email image")
    .populate("recipient", "username email image")
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const messages = await applySafePopulateMultiple(query);
  return messages.reverse(); // Ordenar cronológicamente para mostrar
};

// Método estático para obtener conversaciones del usuario con los últimos mensajes
messageSchema.statics.getUserConversations = async function (userId) {
  const conversations = await this.aggregate([
    // Buscar todos los mensajes donde el usuario es sender o recipient
    {
      $match: {
        $or: [
          { sender: new mongoose.Types.ObjectId(userId) },
          { recipient: new mongoose.Types.ObjectId(userId) },
        ],
      },
    },
    // Determinar el "otro" usuario en la conversación
    {
      $addFields: {
        otherUser: {
          $cond: {
            if: { $eq: ["$sender", new mongoose.Types.ObjectId(userId)] },
            then: "$recipient",
            else: "$sender",
          },
        },
      },
    },
    // Agrupar por el otro usuario
    {
      $group: {
        _id: "$otherUser",
        lastMessage: { $first: "$$ROOT" },
        unreadCount: {
          $sum: {
            $cond: {
              if: {
                $and: [
                  { $eq: ["$recipient", new mongoose.Types.ObjectId(userId)] },
                  { $eq: ["$isRead", false] },
                ],
              },
              then: 1,
              else: 0,
            },
          },
        },
      },
    },
    // Ordenar por fecha del último mensaje
    {
      $sort: { "lastMessage.createdAt": -1 },
    },
    // Poblar información del otro usuario
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "user",
      },
    },
    // Filtrar conversaciones donde el usuario aún existe
    {
      $match: {
        "user.0": { $exists: true },
      },
    },
    {
      $unwind: "$user",
    },
    // Proyectar solo los campos necesarios
    {
      $project: {
        _id: 0,
        userId: "$_id",
        user: {
          _id: "$user._id",
          username: "$user.username",
          email: "$user.email",
          image: "$user.image",
        },
        lastMessage: {
          _id: "$lastMessage._id",
          content: "$lastMessage.content",
          createdAt: "$lastMessage.createdAt",
          sender: "$lastMessage.sender",
          isRead: "$lastMessage.isRead",
        },
        unreadCount: 1,
      },
    },
  ]);

  return conversations;
};

// Método estático para marcar mensajes como leídos
messageSchema.statics.markAsRead = async function (senderId, recipientId) {
  const result = await this.updateMany(
    {
      sender: senderId,
      recipient: recipientId,
      isRead: false,
    },
    {
      $set: {
        isRead: true,
        readAt: new Date(),
      },
    }
  );

  return result.modifiedCount;
};

// Método estático para obtener el conteo de mensajes no leídos
messageSchema.statics.getUnreadCount = async function (userId) {
  const count = await this.countDocuments({
    recipient: userId,
    isRead: false,
  });

  return count;
};

// Método estático para limpiar mensajes huérfanos (donde sender o recipient ya no existen)
messageSchema.statics.cleanupOrphanedMessages = async function () {
  try {
    const User = mongoose.model("users");

    // Encontrar mensajes donde el sender ya no existe
    const messagesWithInvalidSender = await this.find({}).select(
      "sender recipient"
    );
    const orphanedMessages = [];

    for (const message of messagesWithInvalidSender) {
      const senderExists = await User.findById(message.sender);
      const recipientExists = await User.findById(message.recipient);

      if (!senderExists || !recipientExists) {
        orphanedMessages.push(message._id);
      }
    }

    if (orphanedMessages.length > 0) {
      await this.deleteMany({ _id: { $in: orphanedMessages } });
      console.log(
        `Limpieza completada: ${orphanedMessages.length} mensajes huérfanos eliminados`
      );
    }

    return orphanedMessages.length;
  } catch (error) {
    console.error("Error en limpieza de mensajes huérfanos:", error);
    throw error;
  }
};

module.exports = mongoose.model("Message", messageSchema);
