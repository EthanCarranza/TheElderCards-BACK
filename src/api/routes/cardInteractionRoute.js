const express = require("express");
const router = express.Router();
const {
  toggleLike,
  toggleFavorite,
  getCardStatistics,
  getUserCardInteraction,
  getUserFavoriteCards
} = require("../controllers/cardInteractionController");
const { isAuth } = require("../../middlewares/auth");
router.post("/:cardId/like", isAuth, toggleLike);
router.post("/:cardId/favorite", isAuth, toggleFavorite);
router.get("/:cardId/stats", getCardStatistics);
router.get("/:cardId/interaction", isAuth, getUserCardInteraction);
router.get("/favorites/mine", isAuth, getUserFavoriteCards);
module.exports = router;
