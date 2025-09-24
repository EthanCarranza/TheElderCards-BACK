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
    console.log("[createCard] req.body:", req.body);
    console.log("[createCard] req.file:", req.file);
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

    if (!title || !description || !type || !faction || !cost) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Faltan datos obligatorios" });
    }

    const factionObj = await Faction.findById(faction);
    if (!factionObj) {
      return res.status(HTTP_RESPONSES.BAD_REQUEST).json({ message: "Faccion no valida" });
    }
    const frameColor = factionObj.color || "#cccccc";

    if (!req.file || !req.file.path) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "No se recibio archivo de imagen" });
    }

    const parsedCost = Number(cost);
    if (Number.isNaN(parsedCost)) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Coste no valido" });
    }
    if (parsedCost < 0 || parsedCost > 10) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "El coste debe estar entre 0 y 10" });
    }

    let parsedAttack;
    let parsedDefense;
    if (type === "Creature") {
      if (
        attack === undefined ||
        attack === null ||
        attack === "" ||
        defense === undefined ||
        defense === null ||
        defense === ""
      ) {
        return res
          .status(HTTP_RESPONSES.BAD_REQUEST)
          .json({ message: "Faltan valores de ataque o defensa" });
      }
      parsedAttack = Number(attack);
      parsedDefense = Number(defense);
      if (Number.isNaN(parsedAttack) || Number.isNaN(parsedDefense)) {
        return res
          .status(HTTP_RESPONSES.BAD_REQUEST)
          .json({ message: "Ataque o defensa no validos" });
      }
      if (parsedAttack < 0 || parsedAttack > 10 || parsedDefense < 1 || parsedDefense > 10) {
        return res
          .status(HTTP_RESPONSES.BAD_REQUEST)
          .json({ message: "Ataque debe estar entre 0 y 10 y defensa entre 1 y 10" });
      }
    }

    const imgUrl = await generateFramedImage(
      req.file.path,
      title,
      type,
      parsedCost,
      description,
      frameColor,
      type === "Creature" ? parsedAttack : undefined,
      type === "Creature" ? parsedDefense : undefined
    );

    if (!imgUrl) {
      return res
        .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR.code)
        .json({ message: "No se pudo generar la imagen de la carta" });
    }

    const creatorName =
      (req.user && (req.user.username || req.user.email)) ||
      creator ||
      "Anonimo";
    const normalizedCreator =
      typeof creatorName === "string"
        ? creatorName.trim()
        : String(creatorName);
    const normalizedTitle =
      typeof title === "string" ? title.trim() : String(title);
    const normalizedDescription =
      typeof description === "string"
        ? description.trim()
        : String(description);
    let parsedDate = date ? new Date(date) : new Date();
    if (Number.isNaN(parsedDate.getTime())) {
      parsedDate = new Date();
    }

    const cardData = {
      title: normalizedTitle,
      description: normalizedDescription,
      type,
      cost: parsedCost,
      faction,
      img: imgUrl,
      creator: normalizedCreator,
      date: parsedDate,
    };

    if (type === "Creature") {
      cardData.attack = parsedAttack;
      cardData.defense = parsedDefense;
    }

    const savedCard = await Card.create(cardData);
    await savedCard.populate("faction");
    return res.status(HTTP_RESPONSES.CREATED).json(savedCard);
  } catch (error) {
    console.log(error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR.code)
      .json(HTTP_RESPONSES.INTERNAL_SERVER_ERROR.message);
  }
};

const mockCreateCard = createCard;

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
