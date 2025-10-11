const Message = require("../models/message");
const Friendship = require("../models/friendship");
const { HTTP_RESPONSES, HTTP_MESSAGES } = require("../models/httpResponses");

const sendMessage = async (req, res) => {
  try {
    const senderId = req.user.id;
    const { recipientId, content } = req.body;

    if (!recipientId) {
      return res.status(HTTP_RESPONSES.BAD_REQUEST).json({
        message: "El destinatario es requerido",
      });
    }

    if (!content || content.trim().length === 0) {
      return res.status(HTTP_RESPONSES.BAD_REQUEST).json({
        message: "El contenido del mensaje es requerido",
      });
    }

    if (content.trim().length > 2000) {
      return res.status(HTTP_RESPONSES.BAD_REQUEST).json({
        message: "El mensaje no puede tener más de 2000 caracteres",
      });
    }

    if (senderId === recipientId) {
      return res.status(HTTP_RESPONSES.BAD_REQUEST).json({
        message: "No puedes enviarte mensajes a ti mismo",
      });
    }

    const friendship = await Friendship.findOne({
      $or: [
        { requester: senderId, recipient: recipientId, status: "accepted" },
        { requester: recipientId, recipient: senderId, status: "accepted" },
      ],
    });

    if (!friendship) {
      return res.status(HTTP_RESPONSES.FORBIDDEN).json({
        message: "Solo puedes enviar mensajes a tus amigos",
      });
    }

    const message = new Message({
      sender: senderId,
      recipient: recipientId,
      content: content.trim(),
    });

    await message.save();

    try {
      await message.populate("sender", "username email image");
      await message.populate("recipient", "username email image");
    } catch (error) {
      console.warn("User populate failed in sendMessage:", error.message);
      const { DELETED_USER_PLACEHOLDER } = require("../../utils/safePopulate");
      if (
        !message.sender ||
        (typeof message.sender === "object" && !message.sender.username)
      ) {
        message.sender = DELETED_USER_PLACEHOLDER;
      }
      if (
        !message.recipient ||
        (typeof message.recipient === "object" && !message.recipient.username)
      ) {
        message.recipient = DELETED_USER_PLACEHOLDER;
      }
    }

    return res.status(HTTP_RESPONSES.CREATED).json({
      message: "Mensaje enviado correctamente",
      data: message,
    });
  } catch (error) {
    console.error("Error al enviar mensaje:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const getConversation = async (req, res) => {
  try {
    const userId = req.user.id;
    const { otherUserId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    if (!otherUserId) {
      return res.status(HTTP_RESPONSES.BAD_REQUEST).json({
        message: "El Id del otro usuario es requerido",
      });
    }
    if (userId === otherUserId) {
      return res.status(HTTP_RESPONSES.BAD_REQUEST).json({
        message: "No puedes tener una conversación contigo mismo",
      });
    }

    const messages = await Message.getConversation(
      userId,
      otherUserId,
      parseInt(page),
      parseInt(limit)
    );

    if (!messages || messages.length === 0) {
      return res.status(HTTP_RESPONSES.NOT_FOUND).json({
        message: "La conversación no existe o no hay mensajes.",
      });
    }

    await Message.markAsRead(otherUserId, userId);

    return res.status(HTTP_RESPONSES.OK).json({
      messages,
      page: parseInt(page),
      limit: parseInt(limit),
      total: messages.length,
    });
  } catch (error) {
    console.error("Error al obtener conversación:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const getConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    const existingConversations = await Message.getUserConversations(userId);
    const friendships = await Friendship.getFriends(userId);

    const existingConversationMap = new Map();
    existingConversations.forEach((conv) => {
      existingConversationMap.set(conv.userId.toString(), conv);
    });

    const allConversations = [...existingConversations];

    friendships.forEach((friendship) => {
      const friend =
        friendship.requester._id.toString() === userId
          ? friendship.recipient
          : friendship.requester;
      if (
        friend &&
        friend._id &&
        !existingConversationMap.has(friend._id.toString())
      ) {
        allConversations.push({
          userId: friend._id,
          user: {
            _id: friend._id,
            username: friend.username,
            email: friend.email,
            image: friend.image,
          },
          lastMessage: null,
          unreadCount: 0,
        });
      }
    });

    return res.status(HTTP_RESPONSES.OK).json({
      conversations: allConversations,
      count: allConversations.length,
    });
  } catch (error) {
    console.error("Error al obtener conversaciones:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const markMessagesAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { senderId } = req.params;

    if (!senderId) {
      return res.status(HTTP_RESPONSES.BAD_REQUEST).json({
        message: "El Id del remitente es requerido",
      });
    }
    if (userId === senderId) {
      return res.status(HTTP_RESPONSES.BAD_REQUEST).json({
        message: "No puedes tener una conversación contigo mismo",
      });
    }
    const modifiedCount = await Message.markAsRead(senderId, userId);

    return res.status(HTTP_RESPONSES.OK).json({
      message: "Mensajes marcados como leídos",
      modifiedCount,
    });
  } catch (error) {
    console.error("Error al marcar mensajes como leídos:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;
    const unreadCount = await Message.getUnreadCount(userId);

    return res.status(HTTP_RESPONSES.OK).json({
      unreadCount,
    });
  } catch (error) {
    console.error("Error al obtener conteo de mensajes no leídos:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

module.exports = {
  sendMessage,
  getConversation,
  getConversations,
  markMessagesAsRead,
  getUnreadCount,
};
