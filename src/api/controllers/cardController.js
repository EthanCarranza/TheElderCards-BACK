const { HTTP_RESPONSES, HTTP_MESSAGES } = require("../models/httpResponses");
const Card = require("../models/card");
const User = require("../models/user");
const Faction = require("../models/faction");
const Collection = require("../models/collection");
const CardInteraction = require("../models/cardInteraction");
const { generateFramedImage } = require("../../utils/cardGenerator");
const { deleteImageFromCloudinary } = require("../../utils/cloudinaryHelper");
const mongoose = require("mongoose");
const fs = require("fs");

const getCards = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      sort,
      user: userId,
      favorites,
      liked,
      myCards,
      ...filters
    } = req.query;
    const query = {};

    if (filters.type) query.type = filters.type;
    if (filters.faction) query.faction = filters.faction;
    if (filters.title) query.title = { $regex: filters.title, $options: "i" };
    if (filters.creator) {
      if (req.user) {
        const creatorUser = await User.findOne({
          $or: [
            { username: { $regex: filters.creator, $options: "i" } },
            { email: { $regex: filters.creator, $options: "i" } },
          ],
        }).select("_id");

        if (
          creatorUser &&
          creatorUser._id.toString() !== req.user._id.toString()
        ) {
          const Friendship = require("../models/friendship");
          const blockingRelationship = await Friendship.findOne({
            $or: [
              {
                requester: creatorUser._id,
                recipient: req.user._id,
                status: "blocked",
              },
              {
                requester: req.user._id,
                recipient: creatorUser._id,
                status: "blocked",
              },
            ],
          });
          if (blockingRelationship) {
            return res.status(HTTP_RESPONSES.OK).json({
              cards: [],
              total: 0,
              page: parseInt(page),
              limit: parseInt(limit),
              totalPages: 0,
            });
          }
        }
      }
      query.creator = { $regex: filters.creator, $options: "i" };
    }
    if (filters.cost) query.cost = filters.cost;
    if (filters.type && filters.type === "Creature") {
      if (filters.attack) query.attack = filters.attack;
      if (filters.defense) query.defense = filters.defense;
    }

    let cardIds = null;
    if (favorites === "true" && userId) {
      const favoriteInteractions = await CardInteraction.find({
        userId,
        favorited: true,
      }).select("cardId");
      cardIds = favoriteInteractions.map((interaction) => interaction.cardId);
    }

    if (liked === "true" && userId) {
      const likedInteractions = await CardInteraction.find({
        userId,
        liked: true,
      }).select("cardId");
      const likedIds = likedInteractions.map(
        (interaction) => interaction.cardId
      );

      if (cardIds) {
        cardIds = cardIds.filter((id) =>
          likedIds.some((likedId) => likedId.toString() === id.toString())
        );
      } else {
        cardIds = likedIds;
      }
    }

    if (myCards === "true" && userId) {
      const userCreator = await User.findById(userId).select("username email");
      if (userCreator) {
        const creatorName = userCreator.username || userCreator.email;
        query.creator = creatorName;
      }
    }

    if (cardIds !== null) {
      query._id = { $in: cardIds };
    }

    if (req.user) {
      const Friendship = require("../models/friendship");
      const blockingRelationships = await Friendship.find({
        $or: [
          { recipient: req.user._id, status: "blocked" },
          { requester: req.user._id, status: "blocked" },
        ],
      }).select("requester recipient");
      const blockingUserIds = blockingRelationships.map((rel) =>
        rel.requester.toString() === req.user._id.toString()
          ? rel.recipient
          : rel.requester
      );
      if (blockingUserIds.length > 0) {
        const blockingUsers = await User.find({
          _id: { $in: blockingUserIds },
        }).select("username email");
        const blockingCreators = blockingUsers
          .flatMap((user) => [user.username, user.email])
          .filter(Boolean);
        if (blockingCreators.length > 0) {
          if (!query.creator) {
            query.creator = { $nin: blockingCreators };
          } else if (query.creator.$in) {
            query.creator.$nin = blockingCreators;
          } else if (query.creator.$regex) {
            query.$and = [
              {
                creator: {
                  $regex: query.creator.$regex,
                  $options: query.creator.$options,
                },
              },
              { creator: { $nin: blockingCreators } },
            ];
            delete query.creator;
          } else if (typeof query.creator === "string") {
            query.$and = [
              { creator: query.creator },
              { creator: { $nin: blockingCreators } },
            ];
            delete query.creator;
          }
        }
      }
    }

    let sortObj = {};
    if (sort) {
      if (sort === "most_liked") {
        let matchQuery = { ...query };
        if (req.user) {
          const Friendship = require("../models/friendship");
          const blockingRelationships = await Friendship.find({
            $or: [
              { recipient: req.user._id, status: "blocked" },
              { requester: req.user._id, status: "blocked" },
            ],
          }).select("requester recipient");
          const blockingUserIds = blockingRelationships.map((rel) =>
            rel.requester.toString() === req.user._id.toString()
              ? rel.recipient
              : rel.requester
          );
          if (blockingUserIds.length > 0) {
            const blockingUsers = await User.find({
              _id: { $in: blockingUserIds },
            }).select("username email");
            const blockingCreators = blockingUsers
              .flatMap((user) => [user.username, user.email])
              .filter(Boolean);
            if (blockingCreators.length > 0) {
              if (!matchQuery.creator) {
                matchQuery.creator = { $nin: blockingCreators };
              } else if (matchQuery.creator.$in) {
                matchQuery.creator.$nin = blockingCreators;
              } else if (matchQuery.creator.$regex) {
                matchQuery.$and = [
                  {
                    creator: {
                      $regex: matchQuery.creator.$regex,
                      $options: matchQuery.creator.$options,
                    },
                  },
                  { creator: { $nin: blockingCreators } },
                ];
                delete matchQuery.creator;
              } else if (typeof matchQuery.creator === "string") {
                matchQuery.$and = [
                  { creator: matchQuery.creator },
                  { creator: { $nin: blockingCreators } },
                ];
                delete matchQuery.creator;
              }
            }
          }
        }

        const pipeline = [
          { $match: matchQuery },
          {
            $lookup: {
              from: "cardinteractions",
              localField: "_id",
              foreignField: "cardId",
              as: "interactions",
            },
          },
          {
            $addFields: {
              likesCount: {
                $size: {
                  $filter: {
                    input: "$interactions",
                    cond: { $eq: ["$$this.liked", true] },
                  },
                },
              },
            },
          },
          { $sort: { likesCount: -1 } },
          { $skip: (parseInt(page) - 1) * parseInt(limit) },
          { $limit: parseInt(limit) },
        ];

        const cards = await Card.aggregate(pipeline);
        const total = await Card.countDocuments(matchQuery);

        return res.status(HTTP_RESPONSES.OK).json({
          cards,
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit)),
        });
      } else {
        const [field, direction] = sort.split("_");
        sortObj[field] = direction === "desc" ? -1 : 1;
      }
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
    console.error("Error al obtener cartas:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const createCard = async (req, res, next) => {
  try {
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
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Faccion no valida" });
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
      if (
        parsedAttack < 0 ||
        parsedAttack > 10 ||
        parsedDefense < 1 ||
        parsedDefense > 10
      ) {
        return res.status(HTTP_RESPONSES.BAD_REQUEST).json({
          message: "Ataque debe estar entre 0 y 10 y defensa entre 1 y 10",
        });
      }
    }

    const creatorName =
      (req.user && (req.user.username || req.user.email)) ||
      creator ||
      "Anonimo";
    const normalizedCreator =
      typeof creatorName === "string" && creatorName.trim().length > 0
        ? creatorName.trim()
        : String(creatorName || "Anónimo");
    console.log("Iniciando generación de imagen...");

    let imgUrl;
    try {
      imgUrl = await generateFramedImage(
        req.file.path,
        title,
        type,
        parsedCost,
        description,
        frameColor,
        normalizedCreator,
        type === "Creature" ? parsedAttack : undefined,
        type === "Creature" ? parsedDefense : undefined
      );
      console.log("Imagen generada exitosamente:", imgUrl);
    } catch (imageError) {
      console.error("ERROR en generación de imagen:", imageError);

      try {
        await fs.promises.unlink(req.file.path);
      } catch (unlinkError) {
        console.error("No se pudo eliminar imagen subida:", unlinkError);
      }

      return res.status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR).json({
        message: "Error al generar la imagen de la carta",
        error: imageError.message,
        details:
          "La imagen no pudo ser procesada correctamente. Verifica que el formato sea válido e inténtalo de nuevo.",
      });
    }

    if (!imgUrl) {
      return res.status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR).json({
        message: "No se pudo generar la imagen de la carta",
      });
    }

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

    console.log("Intentando crear carta...");

    const savedCard = await Card.create(cardData);
    console.log("Carta creada exitosamente:", savedCard._id);

    try {
      await savedCard.populate("faction");
    } catch (error) {
      console.warn("Faction populate failed:", error.message);
    }

    return res.status(HTTP_RESPONSES.CREATED).json(savedCard);
  } catch (error) {
    console.error("Error al crear carta:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json({ message: "Error interno del servidor", error: error.message });
  }
};

const getCardById = async (req, res, next) => {
  try {
    const card = await Card.findById(req.params.id);
    if (!card) {
      return res
        .status(HTTP_RESPONSES.NOT_FOUND)
        .json({ message: "Carta no encontrada" });
    }
    return res.status(HTTP_RESPONSES.OK).json(card);
  } catch (error) {
    console.error("Error al obtener carta por Id:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const updateCard = async (req, res, next) => {
  try {
    const { id } = req.params;

    const existingCard = await Card.findById(id);
    if (!existingCard) {
      return res
        .status(HTTP_RESPONSES.NOT_FOUND)
        .json({ message: "Carta no encontrada" });
    }

    if (req.body.img && req.body.img !== existingCard.img) {
      if (existingCard.img) {
        await deleteImageFromCloudinary(existingCard.img);
      }
    }

    const card = await Card.findByIdAndUpdate(id, req.body, {
      new: true,
    });

    return res.status(HTTP_RESPONSES.OK).json(card);
  } catch (error) {
    console.error("Error al actualizar carta:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const deleteCard = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Id de carta requerido" });
    } else if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Id de carta inválido" });
    }

    const card = await Card.findById(id);
    if (!card) {
      return res
        .status(HTTP_RESPONSES.NOT_FOUND)
        .json({ message: "Carta no encontrada" });
    }

    const userCreator = req.user?.username || req.user?.email || "Anónimo";
    const isAdmin = req.user?.role === "admin";
    const isOwner = card.creator.toLowerCase() === userCreator.toLowerCase();

    if (!isAdmin && !isOwner) {
      return res
        .status(HTTP_RESPONSES.FORBIDDEN)
        .json({ message: "No tienes permiso para eliminar esta carta" });
    }

    if (card.img) {
      await deleteImageFromCloudinary(card.img);
    }

    // Eliminar la carta de la base de datos
    await Card.findByIdAndDelete(id);

    await Collection.updateMany({ cards: id }, { $pull: { cards: id } });

    return res
      .status(HTTP_RESPONSES.OK)
      .json({ message: "Carta eliminada correctamente" });
  } catch (error) {
    console.error("Error al eliminar carta:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
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
        .json({ message: "Colección no encontrada" });
    }
    if (collection.creator.toString() !== userId.toString()) {
      return res
        .status(HTTP_RESPONSES.FORBIDDEN)
        .json({ message: "No tienes permiso para modificar esta colección" });
    }
    const alreadyIn = collection.cards
      .map((id) => id.toString())
      .includes(cardId);
    if (alreadyIn) {
      return res
        .status(HTTP_RESPONSES.CONFLICT)
        .json({ message: "La carta ya está en la colección" });
    }
    collection.cards.push(cardId);
    await collection.save();
    return res
      .status(HTTP_RESPONSES.OK)
      .json({ cards: collection.cards, added: true });
  } catch (error) {
    console.error("Error al agregar carta a colección:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
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
        .json({ message: "Colección no encontrada" });
    }
    if (collection.creator.toString() !== userId.toString()) {
      return res
        .status(HTTP_RESPONSES.FORBIDDEN)
        .json({ message: "No tienes permiso para modificar esta colección" });
    }
    const wasIn = collection.cards.map((id) => id.toString()).includes(cardId);
    let removed = false;
    if (wasIn) {
      collection.cards = collection.cards.filter(
        (id) => id.toString() !== cardId
      );
      await collection.save();
      removed = true;
    }
    return res
      .status(HTTP_RESPONSES.OK)
      .json({ cards: collection.cards, removed });
  } catch (error) {
    console.error("Error al quitar carta de colección:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const addToFavorites = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { cardId } = req.body;
    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(HTTP_RESPONSES.NOT_FOUND)
        .json({ message: "Usuario no encontrado" });
    }
    if (!user.favorites.includes(cardId)) {
      user.favorites.push(cardId);
      await user.save();
    }
    return res.status(HTTP_RESPONSES.OK).json(user.favorites);
  } catch (error) {
    console.error("Error al agregar carta a favoritos:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const removeFromFavorites = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { cardId } = req.body;
    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(HTTP_RESPONSES.NOT_FOUND)
        .json({ message: "Usuario no encontrado" });
    }
    user.favorites = user.favorites.filter((id) => id.toString() !== cardId);
    await user.save();
    return res.status(HTTP_RESPONSES.OK).json(user.favorites);
  } catch (error) {
    console.error("Error al quitar carta de favoritos:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

module.exports = {
  getCards,
  createCard,
  getCardById,
  updateCard,
  deleteCard,
  addToCollection,
  removeFromCollection,
  addToFavorites,
  removeFromFavorites,
};
