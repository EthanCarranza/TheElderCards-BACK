const express = require("express");
const { isAuth } = require("../../middlewares/auth");
const { uploadCard } = require("../../middlewares/fileStorage");
const {
  getCards,
  getAllCards,
  createCard,
  getCardById,
  updateCard,
  deleteCard,
  addToCollection,
  removeFromCollection,
} = require("../controllers/cardController");
const router = express.Router();

router.get("/", getCards);
router.get("/all", getAllCards);
router.get("/:id", getCardById);
router.post("/", isAuth, uploadCard.single("img"), createCard);
//router.put("/:id", isAuth, uploadCard.single("img"), updateCard);
router.delete("/:id", isAuth, deleteCard);

router.post("/:id/collection", isAuth, addToCollection);
router.delete("/:id/collection", isAuth, removeFromCollection);

module.exports = router;
