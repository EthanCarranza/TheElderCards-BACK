const express = require("express");
const router = express.Router();
const {
  toggleLike,
  toggleFavorite,
  getCollectionStatistics,
  getUserCollectionInteraction,
  getUserFavoriteCollections
} = require("../controllers/collectionInteractionController");
const { isAuth } = require("../../middlewares/auth");

router.post("/:collectionId/like", isAuth, toggleLike);

router.post("/:collectionId/favorite", isAuth, toggleFavorite);

router.get("/:collectionId/stats", getCollectionStatistics);

router.get("/:collectionId/interaction", isAuth, getUserCollectionInteraction);

router.get("/favorites/mine", isAuth, getUserFavoriteCollections);

module.exports = router;