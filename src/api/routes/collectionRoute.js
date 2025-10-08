const express = require("express");
const { isAuth, optionalAuth } = require("../../middlewares/auth");
const {
  getCollections,
  getCollectionById,
  getCollectionByTitle,
  createCollection,
  updateCollection,
  deleteCollection,
  addCardToCollection,
  removeCardFromCollection,
  getCollectionsByUser,
  getMyCollections,
  debugCollection,
  toggleLike,
  toggleFavoriteNew,
  getCollectionStatistics,
  getUserCollectionInteraction,
  getUserFavoriteCollectionsNew,
} = require("../controllers/collectionController");
const { uploadCollection } = require("../../middlewares/fileStorage");

const collectionRouter = express.Router();

collectionRouter.get("/", optionalAuth, getCollections);
collectionRouter.get("/by/user/:userId", optionalAuth, getCollectionsByUser);
collectionRouter.get("/mine", isAuth, getMyCollections);
collectionRouter.get("/favorites/mine", isAuth, getUserFavoriteCollectionsNew);
collectionRouter.get("/get/:title", getCollectionByTitle);
collectionRouter.get("/:id", optionalAuth, getCollectionById);
collectionRouter.post(
  "/",
  isAuth,
  uploadCollection.single("img"),
  createCollection
);
collectionRouter.put(
  "/:id",
  isAuth,
  uploadCollection.single("img"),
  updateCollection
);
collectionRouter.delete("/:id", isAuth, deleteCollection);
collectionRouter.put("/:id/addCard", isAuth, addCardToCollection);
collectionRouter.put("/:id/removeCard", isAuth, removeCardFromCollection);
collectionRouter.post("/:id/favorite", isAuth, toggleFavoriteNew);
collectionRouter.post("/:id/like", isAuth, toggleLike);
collectionRouter.get("/:id/stats", getCollectionStatistics);
collectionRouter.get("/:id/interaction", isAuth, getUserCollectionInteraction);
collectionRouter.get("/debug/:id", optionalAuth, debugCollection);

module.exports = collectionRouter;
