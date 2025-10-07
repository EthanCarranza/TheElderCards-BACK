const express = require("express");
const router = express.Router();
const {
  sendMessage,
  getConversation,
  getConversations,
  markMessagesAsRead,
  getUnreadCount,
  deleteMessage
} = require("../controllers/messageController");
const { isAuth } = require("../../middlewares/auth");

// Obtener todas las conversaciones del usuario
router.get("/conversations", isAuth, getConversations);

// Obtener conteo de mensajes no leídos
router.get("/unread-count", isAuth, getUnreadCount);

// Obtener conversación específica con otro usuario
router.get("/conversation/:otherUserId", isAuth, getConversation);

// Enviar un mensaje
router.post("/", isAuth, sendMessage);

// Marcar mensajes como leídos
router.patch("/read/:senderId", isAuth, markMessagesAsRead);

// Eliminar mensaje (opcional)
router.delete("/:messageId", isAuth, deleteMessage);

module.exports = router;