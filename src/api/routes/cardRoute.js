const express = require("express");
const { isAuth, optionalAuth } = require("../../middlewares/auth");
const { uploadCard } = require("../../middlewares/fileStorage");
const {
  getCards,
  createCard,
  getCardById,
  updateCard,
  deleteCard,
  addToCollection,
  removeFromCollection,
  addToFavorites,
  removeFromFavorites,
} = require("../controllers/cardController");
const router = express.Router();

router.get("/", optionalAuth, getCards);
router.get("/:id", getCardById);
router.post("/", isAuth, uploadCard.single("img"), createCard);
//router.put("/:id", isAuth, uploadCard.single("img"), updateCard);
router.delete("/:id", isAuth, deleteCard);

router.post("/:id/collection", isAuth, addToCollection);
router.delete("/:id/collection", isAuth, removeFromCollection);

router.post("/:id/favorite", isAuth, addToFavorites);
router.delete("/:id/favorite", isAuth, removeFromFavorites);

module.exports = router;
