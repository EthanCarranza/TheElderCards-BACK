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

// Toggle like en una carta
router.post("/:cardId/like", isAuth, toggleLike);

// Toggle favorito en una carta  
router.post("/:cardId/favorite", isAuth, toggleFavorite);

// Obtener estadísticas de una carta
router.get("/:cardId/stats", getCardStatistics);

// Obtener interacciones del usuario con una carta
router.get("/:cardId/interaction", isAuth, getUserCardInteraction);

// Obtener cartas favoritas del usuario
router.get("/favorites/mine", isAuth, getUserFavoriteCards);

module.exports = router;