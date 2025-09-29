const { HTTP_RESPONSES, HTTP_MESSAGES } = require("../models/httpResponses");
const Collection = require("../models/collection");
const mongoose = require("mongoose");

const getCollections = async (req, res, next) => {
  try {
    const collections = await Collection.find().populate("cards");
    if (collections.length !== 0) {
      return res.status(HTTP_RESPONSES.OK).json(collections);
    }
    return res.status(HTTP_RESPONSES.NOT_FOUND).json("No hay colecciones");
  } catch (error) {
    console.log(error);
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
        .json("Id de colección no válido");
    }
    const collection = await Collection.findById(id).populate("cards");
    if (!collection) {
      return res
        .status(HTTP_RESPONSES.NOT_FOUND)
        .json("Colección no encontrada");
    }
    return res.status(HTTP_RESPONSES.OK).json(collection);
  } catch (error) {
    console.log(error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const getCollectionByTitle = async (req, res, next) => {
  try {
    const { title } = req.params;
    if (!title) {
      return res.status(HTTP_RESPONSES.BAD_REQUEST).json("Titulo faltante");
    }
    const collection = await Collection.findOne({ title }).populate("cards");
    if (!collection) {
      return res
        .status(HTTP_RESPONSES.NOT_FOUND)
        .json("Colección no encontrada");
    }
    return res.status(HTTP_RESPONSES.OK).json(collection);
  } catch (error) {
    console.log(error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const createCollection = async (req, res, next) => {
  try {
    const newCollection = new Collection({
      title: req.body.title,
      description: req.body.description,
      img: req.file ? req.file.path : null,
      creator: req.body.creator,
      cards: req.body.cards || [],
    });
    const collection = await newCollection.save();
    return res.status(HTTP_RESPONSES.CREATED).json(collection);
  } catch (error) {
    console.log(error);
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
        .json("Id de colección o carta faltante");
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
    console.log(error);
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
        .json("Id de colección o carta faltante");
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
    console.log(error);
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
    console.error("Error al eliminar la colección:", error);
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
  addCardToCollection,
  removeCardFromCollection,
};
