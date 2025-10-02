const express = require("express");
const { isAuth } = require("../../middlewares/auth");
const {
  getCollections,
  getCollectionById,
  getCollectionByTitle,
  createCollection,
  deleteCollection,
  addCardToCollection,
  removeCardFromCollection,
  getCollectionsByUser,
  getMyCollections,
  addFavoriteCollection,
  removeFavoriteCollection,
  getFavoriteCollections,
} = require("../controllers/collectionController");
const { uploadCollection } = require("../../middlewares/fileStorage");

const collectionRouter = express.Router();

collectionRouter.get("/", getCollections);
collectionRouter.get("/by/user/:userId", getCollectionsByUser);
collectionRouter.get("/mine", isAuth, getMyCollections);
collectionRouter.get("/:id", getCollectionById);
collectionRouter.get("/get/:title", getCollectionByTitle);
collectionRouter.post(
  "/",
  isAuth,
  uploadCollection.single("img"),
  createCollection
);
collectionRouter.delete("/:id", isAuth, deleteCollection);
collectionRouter.put("/:id/addCard", isAuth, addCardToCollection);
collectionRouter.put("/:id/removeCard", isAuth, removeCardFromCollection);
collectionRouter.post("/:id/favorite", isAuth, addFavoriteCollection);
collectionRouter.delete("/:id/favorite", isAuth, removeFavoriteCollection);
collectionRouter.get("/favorites/mine", isAuth, getFavoriteCollections);

module.exports = collectionRouter;
