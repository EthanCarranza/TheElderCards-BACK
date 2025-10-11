const express = require("express");
const router = express.Router();
const {
  sendMessage,
  getConversation,
  getConversations,
  markMessagesAsRead,
  getUnreadCount,
} = require("../controllers/messageController");
const { isAuth } = require("../../middlewares/auth");

router.get("/conversations", isAuth, getConversations);
router.get("/unread-count", isAuth, getUnreadCount);
router.get("/conversation/:otherUserId", isAuth, getConversation);
router.post("/", isAuth, sendMessage);
router.patch("/read/:senderId", isAuth, markMessagesAsRead);

module.exports = router;
