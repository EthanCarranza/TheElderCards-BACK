const Message = require("../models/message");
const Friendship = require("../models/friendship");
const User = require("../models/user");
const { HTTP_RESPONSES, HTTP_MESSAGES } = require("../models/httpResponses");

// Enviar un mensaje
const sendMessage = async (req, res) => {
  try {
    const senderId = req.user.id;
    const { recipientId, content } = req.body;

    // Validaciones básicas
    if (!recipientId) {
      return res.status(HTTP_RESPONSES.BAD_REQUEST).json({
        message: "El destinatario es requerido"
      });
    }

    if (!content || content.trim().length === 0) {
      return res.status(HTTP_RESPONSES.BAD_REQUEST).json({
        message: "El contenido del mensaje es requerido"
      });
    }

    if (content.trim().length > 2000) {
      return res.status(HTTP_RESPONSES.BAD_REQUEST).json({
        message: "El mensaje no puede tener más de 2000 caracteres"
      });
    }

    if (senderId === recipientId) {
      return res.status(HTTP_RESPONSES.BAD_REQUEST).json({
        message: "No puedes enviarte mensajes a ti mismo"
      });
    }

    // Verificar que existe amistad entre los usuarios
    const friendship = await Friendship.findOne({
      $or: [
        { requester: senderId, recipient: recipientId, status: 'accepted' },
        { requester: recipientId, recipient: senderId, status: 'accepted' }
      ]
    });

    if (!friendship) {
      return res.status(HTTP_RESPONSES.FORBIDDEN).json({
        message: "Solo puedes enviar mensajes a tus amigos"
      });
    }

    // Crear el mensaje
    const message = new Message({
      sender: senderId,
      recipient: recipientId,
      content: content.trim()
    });

    await message.save();
    await message.populate('sender', 'username email image');
    await message.populate('recipient', 'username email image');

    return res.status(HTTP_RESPONSES.CREATED).json({
      message: "Mensaje enviado correctamente",
      data: message
    });

  } catch (error) {
    console.error("Error al enviar mensaje:", error);
    return res.status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR).json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

// Obtener conversación con un usuario específico
const getConversation = async (req, res) => {
  try {
    const userId = req.user.id;
    const { otherUserId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    if (!otherUserId) {
      return res.status(HTTP_RESPONSES.BAD_REQUEST).json({
        message: "El ID del otro usuario es requerido"
      });
    }

    // Verificar que existe amistad
    const friendship = await Friendship.findOne({
      $or: [
        { requester: userId, recipient: otherUserId, status: 'accepted' },
        { requester: otherUserId, recipient: userId, status: 'accepted' }
      ]
    });

    if (!friendship) {
      return res.status(HTTP_RESPONSES.FORBIDDEN).json({
        message: "Solo puedes ver conversaciones con tus amigos"
      });
    }

    // Obtener mensajes
    const messages = await Message.getConversation(userId, otherUserId, parseInt(page), parseInt(limit));

    // Marcar mensajes como leídos
    await Message.markAsRead(otherUserId, userId);

    return res.status(HTTP_RESPONSES.OK).json({
      messages,
      page: parseInt(page),
      limit: parseInt(limit),
      total: messages.length
    });

  } catch (error) {
    console.error("Error al obtener conversación:", error);
    return res.status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR).json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

// Obtener todas las conversaciones del usuario
const getConversations = async (req, res) => {
  try {
    const userId = req.user.id;

    // Obtener conversaciones existentes (con mensajes)
    const existingConversations = await Message.getUserConversations(userId);

    // Obtener todos los amigos
    const friendships = await Friendship.getFriends(userId);
    
    // Crear un mapa de conversaciones existentes por userId
    const existingConversationMap = new Map();
    existingConversations.forEach(conv => {
      existingConversationMap.set(conv.userId.toString(), conv);
    });

    // Crear conversaciones para amigos que no tienen mensajes aún
    const allConversations = [...existingConversations];
    
    friendships.forEach(friendship => {
      // Determinar quién es el amigo
      const friend = friendship.requester._id.toString() === userId ? friendship.recipient : friendship.requester;
      
      // Si no existe conversación con este amigo, crear una vacía
      if (!existingConversationMap.has(friend._id.toString())) {
        allConversations.push({
          userId: friend._id,
          user: {
            _id: friend._id,
            username: friend.username,
            email: friend.email,
            image: friend.image
          },
          lastMessage: null,
          unreadCount: 0
        });
      }
    });

    return res.status(HTTP_RESPONSES.OK).json({
      conversations: allConversations,
      count: allConversations.length
    });

  } catch (error) {
    console.error("Error al obtener conversaciones:", error);
    return res.status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR).json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

// Marcar mensajes como leídos
const markMessagesAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { senderId } = req.params;

    if (!senderId) {
      return res.status(HTTP_RESPONSES.BAD_REQUEST).json({
        message: "El ID del remitente es requerido"
      });
    }

    // Verificar que existe amistad
    const friendship = await Friendship.findOne({
      $or: [
        { requester: userId, recipient: senderId, status: 'accepted' },
        { requester: senderId, recipient: userId, status: 'accepted' }
      ]
    });

    if (!friendship) {
      return res.status(HTTP_RESPONSES.FORBIDDEN).json({
        message: "Solo puedes marcar como leídos mensajes de tus amigos"
      });
    }

    const modifiedCount = await Message.markAsRead(senderId, userId);

    return res.status(HTTP_RESPONSES.OK).json({
      message: "Mensajes marcados como leídos",
      modifiedCount
    });

  } catch (error) {
    console.error("Error al marcar mensajes como leídos:", error);
    return res.status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR).json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

// Obtener conteo de mensajes no leídos
const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;

    const unreadCount = await Message.getUnreadCount(userId);

    return res.status(HTTP_RESPONSES.OK).json({
      unreadCount
    });

  } catch (error) {
    console.error("Error al obtener conteo de mensajes no leídos:", error);
    return res.status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR).json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

// Eliminar mensaje (opcional - solo el remitente puede eliminar)
const deleteMessage = async (req, res) => {
  try {
    const userId = req.user.id;
    const { messageId } = req.params;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(HTTP_RESPONSES.NOT_FOUND).json({
        message: "Mensaje no encontrado"
      });
    }

    // Solo el remitente puede eliminar el mensaje
    if (message.sender.toString() !== userId) {
      return res.status(HTTP_RESPONSES.FORBIDDEN).json({
        message: "Solo puedes eliminar tus propios mensajes"
      });
    }

    await Message.findByIdAndDelete(messageId);

    return res.status(HTTP_RESPONSES.OK).json({
      message: "Mensaje eliminado correctamente"
    });

  } catch (error) {
    console.error("Error al eliminar mensaje:", error);
    return res.status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR).json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

module.exports = {
  sendMessage,
  getConversation,
  getConversations,
  markMessagesAsRead,
  getUnreadCount,
  deleteMessage
};