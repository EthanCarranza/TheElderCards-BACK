const { HTTP_RESPONSES } = require("../models/httpResponses");
const Card = require("../models/card");
const User = require("../models/user");
const Faction = require("../models/faction");
const Collection = require("../models/collection");
const { generateFramedImage } = require("../../utils/cardGenerator");

const getCards = async (req, res, next) => {
  try {
    console.log("Fetching cards with filters:", req.query);
    const { page = 1, limit = 20, sort, ...filters } = req.query;
    const query = {};
    if (filters.type) query.type = filters.type;
    if (filters.faction) query.faction = filters.faction;
    if (filters.title) query.title = { $regex: filters.title, $options: "i" };
    if (filters.creator) query.creator = filters.creator;
    if (filters.cost) query.cost = filters.cost;
    if (filters.type && filters.type === "Creature") {
      if (filters.attack) query.attack = filters.attack;
      if (filters.defense) query.defense = filters.defense;
    }

    let sortObj = {};
    if (sort) {
      const [field, direction] = sort.split("_");
      sortObj[field] = direction === "desc" ? -1 : 1;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const cards = await Card.find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Card.countDocuments(query);

    return res.status(HTTP_RESPONSES.OK).json({
      cards,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    console.log(error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR.code)
      .json(HTTP_RESPONSES.INTERNAL_SERVER_ERROR.message);
  }
};

const getAllCards = async (req, res, next) => {
  try {
    const cards = await Card.find();
    if (cards.length !== 0) {
      return res.status(HTTP_RESPONSES.OK).json(cards);
    }
    return res.status(HTTP_RESPONSES.NOT_FOUND).json("No hay cartas");
  } catch (error) {
    console.log(error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR.code)
      .json(HTTP_RESPONSES.INTERNAL_SERVER_ERROR.message);
  }
};

const createCard = async (req, res, next) => {
  try {
    const card = new Card(req.body);
    const factionExists = await Card.findById(card.faction);
    if (!factionExists) {
      return res.status(HTTP_RESPONSES.BAD_REQUEST).json("Facción no válida");
    }
    //lógica para crear carta
    await card.save();
    return res.status(HTTP_RESPONSES.CREATED).json(card);
  } catch (error) {
    console.log(error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR.code)
      .json(HTTP_RESPONSES.INTERNAL_SERVER_ERROR.message);
  }
};

const mockCreateCard = async (req, res, next) => {
  try {
    console.log("[mockCreateCard] req.body:", req.body);
    console.log("[mockCreateCard] req.file:", req.file);
    const {
      title,
      date,
      description,
      creator,
      type,
      cost,
      faction,
      attack,
      defense,
    } = req.body;

    // Comprobación de datos obligatorios
    if (!title || !type || !faction) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json("Faltan datos obligatorios");
    }

    // Comprobar que la facción existe y obtener su color
    const factionObj = await Faction.findById(faction);
    if (!factionObj) {
      return res.status(HTTP_RESPONSES.BAD_REQUEST).json("Facción no válida");
    }
    const frameColor = factionObj.color || "#cccccc";

    // Depuración: si no hay archivo, devolver mensaje
    if (!req.file) {
      return res.status(400).json({
        error: "No se recibió archivo de imagen",
        body: req.body,
        file: req.file,
      });
    }

    console.log("[mockCreateCard] req.file.path:", req.file.path);
    // Generar imagen de carta solo si hay archivo
    let imgUrl = null;
    if (req.file && req.file.path) {
      imgUrl = await generateFramedImage(
        req.file.path,
        title,
        type,
        cost,
        description,
        frameColor,
        type === "Creature" ? attack : undefined,
        type === "Creature" ? defense : undefined
      );
    }

    // Crear objeto carta
    const cardData = {
      title,
      date,
      description,
      img: imgUrl,
      creator,
      type,
      cost,
      faction,
    };
    if (type === "Creature") {
      cardData.attack = attack;
      cardData.defense = defense;
    }

    // const card = await new Card(cardData).save();
    // return res.status(HTTP_RESPONSES.CREATED).json(card);

    // Si solo quieres devolver el objeto mock:
    return res.status(HTTP_RESPONSES.CREATED).json(cardData);
  } catch (error) {
    console.log(error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR.code)
      .json(HTTP_RESPONSES.INTERNAL_SERVER_ERROR.message);
  }
};

const getCardById = async (req, res, next) => {
  try {
    const card = await Card.findById(req.params.id);
    if (!card) {
      return res.status(HTTP_RESPONSES.NOT_FOUND).json("Carta no encontrada");
    }
    return res.status(HTTP_RESPONSES.OK).json(card);
  } catch (error) {
    console.log(error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR.code)
      .json(HTTP_RESPONSES.INTERNAL_SERVER_ERROR.message);
  }
};

const updateCard = async (req, res, next) => {
  try {
    const card = await Card.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!card) {
      return res.status(HTTP_RESPONSES.NOT_FOUND).json("Carta no encontrada");
    }
    return res.status(HTTP_RESPONSES.OK).json(card);
  } catch (error) {
    console.log(error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR.code)
      .json(HTTP_RESPONSES.INTERNAL_SERVER_ERROR.message);
  }
};

const deleteCard = async (req, res, next) => {
  try {
    const card = await Card.findByIdAndDelete(req.params.id);
    if (!card) {
      return res.status(HTTP_RESPONSES.NOT_FOUND).json("Carta no encontrada");
    }
    return res.status(HTTP_RESPONSES.OK).json({ message: "Carta eliminada" });
  } catch (error) {
    console.log(error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR.code)
      .json(HTTP_RESPONSES.INTERNAL_SERVER_ERROR.message);
  }
};

const addToCollection = async (req, res, next) => {
  try {
    const { collectionId, cardId } = req.body;
    const userId = req.user._id;

    let collection = await Collection.findById(collectionId);
    if (!collection) {
      return res
        .status(HTTP_RESPONSES.NOT_FOUND)
        .json("Colección no encontrada");
    }
    if (collection.creator.toString() !== userId.toString()) {
      return res
        .status(HTTP_RESPONSES.FORBIDDEN || 403)
        .json("No tienes permiso para modificar esta colección");
    }
    if (!collection.cards.includes(cardId)) {
      collection.cards.push(cardId);
      await collection.save();
    }
    return res.status(HTTP_RESPONSES.OK).json(collection.cards);
  } catch (error) {
    console.log(error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR.code)
      .json(HTTP_RESPONSES.INTERNAL_SERVER_ERROR.message);
  }
};

const removeFromCollection = async (req, res, next) => {
  try {
    const { collectionId, cardId } = req.body;
    const userId = req.user._id;

    const collection = await Collection.findById(collectionId);
    if (!collection) {
      return res
        .status(HTTP_RESPONSES.NOT_FOUND)
        .json("Colección no encontrada");
    }
    if (collection.creator.toString() !== userId.toString()) {
      return res
        .status(HTTP_RESPONSES.FORBIDDEN || 403)
        .json("No tienes permiso para modificar esta colección");
    }
    collection.cards = collection.cards.filter(
      (id) => id.toString() !== cardId
    );
    await collection.save();
    return res.status(HTTP_RESPONSES.OK).json(collection.cards);
  } catch (error) {
    console.log(error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR.code)
      .json(HTTP_RESPONSES.INTERNAL_SERVER_ERROR.message);
  }
};

const addToFavorites = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { cardId } = req.body;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(HTTP_RESPONSES.NOT_FOUND).json("Usuario no encontrado");
    }
    if (!user.favorites.includes(cardId)) {
      user.favorites.push(cardId);
      await user.save();
    }
    return res.status(HTTP_RESPONSES.OK).json(user.favorites);
  } catch (error) {
    console.log(error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR.code)
      .json(HTTP_RESPONSES.INTERNAL_SERVER_ERROR.message);
  }
};

const removeFromFavorites = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { cardId } = req.body;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(HTTP_RESPONSES.NOT_FOUND).json("Usuario no encontrado");
    }
    user.favorites = user.favorites.filter((id) => id.toString() !== cardId);
    await user.save();
    return res.status(HTTP_RESPONSES.OK).json(user.favorites);
  } catch (error) {
    console.log(error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR.code)
      .json(HTTP_RESPONSES.INTERNAL_SERVER_ERROR.message);
  }
};

module.exports = {
  getCards,
  getAllCards,
  createCard,
  getCardById,
  updateCard,
  deleteCard,
  addToCollection,
  removeFromCollection,
  addToFavorites,
  removeFromFavorites,

  mockCreateCard,
};
