const { HTTP_RESPONSES, HTTP_MESSAGES } = require("../models/httpResponses");
const Collection = require("../models/collection");
const User = require("../models/user");
const mongoose = require("mongoose");
const getCollections = async (req, res, next) => {
  try {
    const collections = await Collection.find().populate("cards");
    if (collections.length !== 0) {
      return res.status(HTTP_RESPONSES.OK).json(collections);
    }
    return res.status(HTTP_RESPONSES.NOT_FOUND).json("No hay colecciones");
  } catch (error) {
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};
const getCollectionById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json("ID de colección no válido");
    }
    const collection = await Collection.findById(id).populate("cards");
    if (!collection) {
      return res
        .status(HTTP_RESPONSES.NOT_FOUND)
        .json("Colección no encontrada");
    }
    return res.status(HTTP_RESPONSES.OK).json(collection);
  } catch (error) {
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};
const getCollectionByTitle = async (req, res, next) => {
  try {
    const { title } = req.params;
    if (!title) {
      return res.status(HTTP_RESPONSES.BAD_REQUEST).json("Título faltante");
    }
    const collection = await Collection.findOne({ title }).populate("cards");
    if (!collection) {
      return res
        .status(HTTP_RESPONSES.NOT_FOUND)
        .json("Colección no encontrada");
    }
    return res.status(HTTP_RESPONSES.OK).json(collection);
  } catch (error) {
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};
const createCollection = async (req, res, next) => {
  try {
    if (!req.user) {
      return res
        .status(HTTP_RESPONSES.UNAUTHORIZED)
        .json({ message: "Token no proporcionado, acceso no autorizado" });
    }
    const title = (req.body.title || "").trim();
    if (!title) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Título faltante" });
    }
    const newCollection = new Collection({
      title,
      description: req.body.description || "",
      img: req.file ? req.file.path : null,
      creator: req.user._id.toString(),
      cards: Array.isArray(req.body.cards) ? req.body.cards : [],
    });
    const collection = await newCollection.save();
    return res.status(HTTP_RESPONSES.CREATED).json(collection);
  } catch (error) {
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};
const addCardToCollection = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { cardId } = req.body;
    if (!id || !cardId) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json("ID de colección o carta faltante");
    }
    const collection = await Collection.findById(id);
    if (!collection) {
      return res
        .status(HTTP_RESPONSES.NOT_FOUND)
        .json("Colección no encontrada");
    }
    if (!collection.cards.map((c) => c.toString()).includes(cardId)) {
      collection.cards.push(cardId);
      await collection.save();
      return res.status(HTTP_RESPONSES.OK).json(collection);
    }
    return res.status(200).json({ message: "No changes" });
  } catch (error) {
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};
const removeCardFromCollection = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { cardId } = req.body;
    if (!id || !cardId) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json("ID de colección o carta faltante");
    }
    const collection = await Collection.findById(id);
    if (!collection) {
      return res
        .status(HTTP_RESPONSES.NOT_FOUND)
        .json("Colección no encontrada");
    }
    if (collection.cards.map((c) => c.toString()).includes(cardId)) {
      collection.cards = collection.cards.filter(
        (c) => c.toString() !== cardId
      );
      await collection.save();
      return res.status(HTTP_RESPONSES.OK).json(collection);
    }
    return res.status(200).json({ message: "No changes" });
  } catch (error) {
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};
const addCardToCollectionSecure = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { cardId } = req.body;
    if (!id || !cardId) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json("ID de colección o carta faltante");
    }
    const collection = await Collection.findById(id);
    if (!collection) {
      return res
        .status(HTTP_RESPONSES.NOT_FOUND)
        .json("Colección no encontrada");
    }
    if (
      !req.user ||
      collection.creator.toString() !== req.user._id.toString()
    ) {
      return res
        .status(HTTP_RESPONSES.FORBIDDEN)
        .json("No tienes permiso para modificar esta colección");
    }
    const alreadyIn = collection.cards
      .map((c) => c.toString())
      .includes(cardId);
    if (alreadyIn) {
      return res
        .status(HTTP_RESPONSES.CONFLICT || 409)
        .json({ message: "La carta ya está en la colección" });
    }
    collection.cards.push(cardId);
    await collection.save();
    const payload =
      typeof collection.toObject === "function"
        ? collection.toObject()
        : collection;
    return res
      .status(HTTP_RESPONSES.OK)
      .json({ ...payload, _meta: { added: true } });
  } catch (error) {
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};
const removeCardFromCollectionSecure = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { cardId } = req.body;
    if (!id || !cardId) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json("ID de colección o carta faltante");
    }
    const collection = await Collection.findById(id);
    if (!collection) {
      return res
        .status(HTTP_RESPONSES.NOT_FOUND)
        .json("Colección no encontrada");
    }
    if (
      !req.user ||
      collection.creator.toString() !== req.user._id.toString()
    ) {
      return res
        .status(HTTP_RESPONSES.FORBIDDEN)
        .json("No tienes permiso para modificar esta colección");
    }
    const wasIn = collection.cards.map((c) => c.toString()).includes(cardId);
    let removed = false;
    if (wasIn) {
      collection.cards = collection.cards.filter(
        (c) => c.toString() !== cardId
      );
      await collection.save();
      removed = true;
    }
    const payload =
      typeof collection.toObject === "function"
        ? collection.toObject()
        : collection;
    return res
      .status(HTTP_RESPONSES.OK)
      .json({ ...payload, _meta: { removed } });
  } catch (error) {
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};
const deleteCollection = async (req, res, next) => {
  try {
    const { id } = req.params;
    const collection = await Collection.findById(id);
    if (!collection) {
      return res
        .status(HTTP_RESPONSES.NOT_FOUND)
        .json({ message: "Colección no encontrada" });
    }
    const userId = req.user._id.toString();
    if (collection.creator.toString() !== userId) {
      return res
        .status(HTTP_RESPONSES.FORBIDDEN)
        .json({ message: "No tienes permiso para eliminar esta colección" });
    }
    await Collection.findByIdAndDelete(id);
    return res
      .status(HTTP_RESPONSES.OK)
      .json({ message: "Colección eliminada correctamente." });
  } catch (error) {
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};
module.exports = {
  getCollections,
  getCollectionById,
  getCollectionByTitle,
  createCollection,
  deleteCollection,
  addCardToCollection: addCardToCollectionSecure,
  removeCardFromCollection: removeCardFromCollectionSecure,
};
const getCollectionsByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "ID de usuario inválido" });
    }
    const collections = await Collection.find({ creator: userId }).populate(
      "cards"
    );
    return res.status(HTTP_RESPONSES.OK).json(collections || []);
  } catch (error) {
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};
const getMyCollections = async (req, res) => {
  try {
    if (!req.user) {
      return res
        .status(HTTP_RESPONSES.UNAUTHORIZED)
        .json({ message: "Token no proporcionado, acceso no autorizado" });
    }
    const collections = await Collection.find({
      creator: req.user._id.toString(),
    }).populate("cards");
    return res.status(HTTP_RESPONSES.OK).json(collections || []);
  } catch (error) {
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};
const addFavoriteCollection = async (req, res) => {
  try {
    if (!req.user) {
      return res
        .status(HTTP_RESPONSES.UNAUTHORIZED)
        .json({ message: "Token no proporcionado, acceso no autorizado" });
    }
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "ID de colección inválido" });
    }
    const exists = await Collection.findById(id);
    if (!exists) {
      return res
        .status(HTTP_RESPONSES.NOT_FOUND)
        .json({ message: "Colección no encontrada" });
    }
    const user = await User.findById(req.user._id);
    if (!user.favoriteCollections.map((c) => c.toString()).includes(id)) {
      user.favoriteCollections.push(id);
      await user.save();
    }
    return res.status(HTTP_RESPONSES.OK).json(user.favoriteCollections);
  } catch (error) {
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};
const removeFavoriteCollection = async (req, res) => {
  try {
    if (!req.user) {
      return res
        .status(HTTP_RESPONSES.UNAUTHORIZED)
        .json({ message: "Token no proporcionado, acceso no autorizado" });
    }
    const { id } = req.params;
    const user = await User.findById(req.user._id);
    user.favoriteCollections = user.favoriteCollections.filter(
      (c) => c.toString() !== id
    );
    await user.save();
    return res.status(HTTP_RESPONSES.OK).json(user.favoriteCollections);
  } catch (error) {
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};
const getFavoriteCollections = async (req, res) => {
  try {
    if (!req.user) {
      return res
        .status(HTTP_RESPONSES.UNAUTHORIZED)
        .json({ message: "Token no proporcionado, acceso no autorizado" });
    }
    const user = await User.findById(req.user._id).populate({
      path: "favoriteCollections",
      populate: { path: "cards" },
    });
    return res.status(HTTP_RESPONSES.OK).json(user?.favoriteCollections || []);
  } catch (error) {
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};
module.exports.getCollectionsByUser = getCollectionsByUser;
module.exports.getMyCollections = getMyCollections;
module.exports.addFavoriteCollection = addFavoriteCollection;
module.exports.removeFavoriteCollection = removeFavoriteCollection;
module.exports.getFavoriteCollections = getFavoriteCollections;
