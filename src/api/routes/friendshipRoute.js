const express = require("express");
const router = express.Router();
const {
  sendFriendRequest,
  respondFriendRequest,
  getFriends,
  getPendingRequests,
  getSentRequests,
  removeFriendship,
  blockUser,
  unblockUser,
  getBlockedUsers,
  searchUsers,
  getRelationshipStatus,
} = require("../controllers/friendshipController");
const { isAuth } = require("../../middlewares/auth");

router.get("/users/search", isAuth, searchUsers);
router.post("/", isAuth, sendFriendRequest);
router.get("/", isAuth, getFriends);
router.get("/pending", isAuth, getPendingRequests);
router.get("/sent", isAuth, getSentRequests);
router.patch("/:friendshipId/respond", isAuth, respondFriendRequest);
router.delete("/:friendshipId", isAuth, removeFriendship);
router.post("/block/:userId", isAuth, blockUser);
router.delete("/block/:userId", isAuth, unblockUser);
router.get("/blocked", isAuth, getBlockedUsers);
router.get("/status/:userId", isAuth, getRelationshipStatus);

module.exports = router;
