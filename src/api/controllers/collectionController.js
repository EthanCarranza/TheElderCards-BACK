const { HTTP_RESPONSES, HTTP_MESSAGES } = require("../models/httpResponses");
const Collection = require("../models/collection");
const CollectionInteraction = require("../models/collectionInteraction");
const User = require("../models/user");
const mongoose = require("mongoose");
const {
  safePopulateUser,
  DELETED_USER_PLACEHOLDER,
} = require("../../utils/safePopulate");

const isOwner = (creatorId, userId) => {
  if (!creatorId || !userId) return false;

  const normalizeId = (id) => {
    if (!id) return "";
    if (typeof id === "string") return id;
    if (id.toString) return id.toString();
    if (id._id) return id._id.toString();
    return String(id);
  };

  const creatorIdStr = normalizeId(creatorId);
  const userIdStr = normalizeId(userId);

  return creatorIdStr === userIdStr && creatorIdStr !== "";
};

const safePopulateCreator = async (collection) => {
  try {
    return await Collection.populate(collection, {
      path: "creator",
      select: "username email"
    });
  } catch (error) {
    collection.creator = DELETED_USER_PLACEHOLDER;
    return collection;
  }
};

const getCollections = async (req, res, next) => {
  try {
    let collections = await Collection.find({ isPrivate: false })
      .populate("cards")
      .exec();

    collections = await Promise.all(collections.map(safePopulateCreator));

    if (req.user) {
      const userId = req.user._id;
      let privateCollections = await Collection.find({ 
        creator: userId, 
        isPrivate: true 
      })
        .populate("cards")
        .exec();

      privateCollections = await Promise.all(privateCollections.map(safePopulateCreator));

      collections = [...collections, ...privateCollections];
    }

    return res.status(HTTP_RESPONSES.OK).json(collections);
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
    const collection = await Collection.findById(id);
    if (!collection) {
      return res
        .status(HTTP_RESPONSES.NOT_FOUND)
        .json("Colección no encontrada");
    }

    const creatorId = collection.creator; // Este es el ID original como string

    if (
      collection.isPrivate &&
      (!req.user || !isOwner(creatorId, req.user._id))
    ) {
      return res
        .status(HTTP_RESPONSES.FORBIDDEN)
        .json("No tienes permiso para ver esta colección privada");
    }

    let populatedCollection = await Collection.findById(id)
      .populate("cards")
      .exec();
      
    if (populatedCollection) {
      try {
        populatedCollection = await Collection.populate(populatedCollection, {
          path: "creator",
          select: "username email"
        });
      } catch (error) {
        populatedCollection.creator = DELETED_USER_PLACEHOLDER;
      }
    }

    return res.status(HTTP_RESPONSES.OK).json(populatedCollection);
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
    let collection = await Collection.findOne({ title })
      .populate("cards")
      .exec();

    if (collection) {
      try {
        collection = await Collection.populate(collection, {
          path: "creator",
          select: "username email"
        });
      } catch (error) {
        collection.creator = DELETED_USER_PLACEHOLDER;
      }
    }
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
    if (!req.user) {
      return res
        .status(HTTP_RESPONSES.UNAUTHORIZED)
        .json({ message: "Token no proporcionado, acceso no autorizado" });
    }

    const title = (req.body.title || "").trim();
    if (!title) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Titulo faltante" });
    }

    const newCollection = new Collection({
      title,
      description: req.body.description || "",
      img: req.file ? req.file.path : null,
      creator: req.user._id,
      isPrivate: req.body.isPrivate === true || req.body.isPrivate === "true",
      cards: Array.isArray(req.body.cards) ? req.body.cards : [],
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

const addCardToCollectionSecure = async (req, res, next) => {
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
    console.log(error);
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
        .json("Id de colección o carta faltante");
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
    console.log(error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const updateCollection = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description, isPrivate } = req.body;

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
        .json({ message: "No tienes permiso para editar esta colección" });
    }

    const updates = {};
    if (title && title.trim()) {
      const existingCollection = await Collection.findOne({
        title: title.trim(),
        _id: { $ne: id },
      });
      if (existingCollection) {
        return res
          .status(HTTP_RESPONSES.CONFLICT)
          .json({ message: "Ya existe una colección con ese título" });
      }
      updates.title = title.trim();
    }

    if (description !== undefined) {
      updates.description = description.trim();
    }

    if (typeof isPrivate === "boolean") {
      updates.isPrivate = isPrivate;
    }

    if (req.file && req.file.path) {
      updates.img = req.file.path;
    }

    const updatedCollection = await Collection.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    }).populate("cards");

    const processedCollection = updatedCollection.toObject();
    try {
      const User = require("../models/user");
      const creator = await User.findById(processedCollection.creator).select(
        "username email"
      );

      if (creator) {
        processedCollection.creator = {
          _id: creator._id,
          username: creator.username,
          email: creator.email,
        };
      } else {
        processedCollection.creator = DELETED_USER_PLACEHOLDER;
      }
    } catch (error) {
      processedCollection.creator = DELETED_USER_PLACEHOLDER;
    }

    return res.status(HTTP_RESPONSES.OK).json(processedCollection);
  } catch (error) {
    console.error("Error al actualizar la colección:", error);
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



const getCollectionsByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Id de usuario invalido" });
    }

    let collections;
    if (req.user && isOwner(userId, req.user._id)) {
      collections = await Collection.find({ creator: userId })
        .populate("cards")
        .exec();
    } else {
      collections = await Collection.find({
        creator: userId,
        isPrivate: false,
      })
        .populate("cards")
        .exec();
    }

    collections = await Promise.all(collections.map(async (collection) => {
      try {
        const populated = await Collection.populate(collection, {
          path: "creator",
          select: "username email"
        });
        return populated;
      } catch (error) {
        collection.creator = DELETED_USER_PLACEHOLDER;
        return collection;
      }
    }));
    return res.status(HTTP_RESPONSES.OK).json(collections || []);
  } catch (error) {
    console.log(error);
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
    let collections = await Collection.find({
      creator: req.user._id.toString(),
    }).populate("cards").exec();

    collections = await Promise.all(collections.map(async (collection) => {
      try {
        const populated = await Collection.populate(collection, {
          path: "creator",
          select: "username email"
        });
        return populated;
      } catch (error) {
        collection.creator = DELETED_USER_PLACEHOLDER;
        return collection;
      }
    }));

    return res.status(HTTP_RESPONSES.OK).json(collections || []);
  } catch (error) {
    console.log(error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};





const debugCollection = async (req, res) => {
  try {
    const { id } = req.params;
    const collection = await Collection.findById(id).populate({
      path: "creator",
      select: "username email _id",
    });

    if (!collection) {
      return res.status(404).json({ error: "Collection not found" });
    }

    return res.status(200).json({
      collection: {
        _id: collection._id,
        title: collection.title,
        isPrivate: collection.isPrivate,
        creator: collection.creator,
      },
      currentUser: req.user
        ? {
            _id: req.user._id,
            username: req.user.username,
            email: req.user.email,
          }
        : null,
      ownershipCheck: req.user
        ? isOwner(collection.creator._id, req.user._id)
        : false,
    });
  } catch (error) {
    console.error("Debug error:", error);
    return res.status(500).json({ error: error.message });
  }
};




const toggleLike = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!id) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "ID de colección requerido" });
    }

    const collection = await Collection.findById(id);
    if (!collection) {
      return res
        .status(HTTP_RESPONSES.NOT_FOUND)
        .json({ message: "Colección no encontrada" });
    }

    let interaction = await CollectionInteraction.findOne({ userId, collectionId: id });

    if (!interaction) {
      interaction = new CollectionInteraction({ userId, collectionId: id });
    }

    const newLikedState = !interaction.liked;
    interaction.liked = newLikedState;
    interaction.likedAt = newLikedState ? new Date() : null;

    await interaction.save();

    const stats = await getCollectionStats(id);

    return res.status(HTTP_RESPONSES.OK).json({
      liked: newLikedState,
      stats,
    });
  } catch (error) {
    console.error("Error al actualizar like:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const toggleFavoriteNew = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!id) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "ID de colección requerido" });
    }

    const collection = await Collection.findById(id);
    if (!collection) {
      return res
        .status(HTTP_RESPONSES.NOT_FOUND)
        .json({ message: "Colección no encontrada" });
    }

    let interaction = await CollectionInteraction.findOne({ userId, collectionId: id });

    if (!interaction) {
      interaction = new CollectionInteraction({ userId, collectionId: id });
    }

    const newFavoritedState = !interaction.favorited;
    interaction.favorited = newFavoritedState;
    interaction.favoritedAt = newFavoritedState ? new Date() : null;

    await interaction.save();

    const stats = await getCollectionStats(id);

    return res.status(HTTP_RESPONSES.OK).json({
      favorited: newFavoritedState,
      stats,
    });
  } catch (error) {
    console.error("Error al actualizar favorito:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const getCollectionStatistics = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "ID de colección requerido" });
    }

    const stats = await getCollectionStats(id);
    return res.status(HTTP_RESPONSES.OK).json(stats);
  } catch (error) {
    console.error("Error al obtener estadísticas:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const getUserCollectionInteraction = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const interaction = await CollectionInteraction.findOne({ userId, collectionId: id });

    return res.status(HTTP_RESPONSES.OK).json({
      liked: interaction?.liked || false,
      favorited: interaction?.favorited || false,
    });
  } catch (error) {
    console.error("Error al obtener interacción:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const getUserFavoriteCollectionsNew = async (req, res) => {
  try {
    const userId = req.user.id;

    let favoriteInteractions;
    try {
      favoriteInteractions = await CollectionInteraction.find({
        userId,
        favorited: true,
      })
        .populate({
          path: "collectionId",
          populate: { 
            path: "cards creator",
            select: "username email" 
          },
        })
        .sort({ favoritedAt: -1 });
    } catch (error) {
      console.warn("Populate failed in getUserFavoriteCollections:", error.message);
      favoriteInteractions = await CollectionInteraction.find({
        userId,
        favorited: true,
      }).sort({ favoritedAt: -1 });
    }

    const collections = favoriteInteractions
      .map((interaction) => interaction.collectionId)
      .filter(collection => collection); // Filtrar nulls

    return res.status(HTTP_RESPONSES.OK).json(collections);
  } catch (error) {
    console.error("Error al obtener colecciones favoritas:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const getCollectionStats = async (collectionId) => {
  const [likesCount, favoritesCount] = await Promise.all([
    CollectionInteraction.countDocuments({ collectionId, liked: true }),
    CollectionInteraction.countDocuments({ collectionId, favorited: true }),
  ]);

  return {
    likes: likesCount,
    favorites: favoritesCount,
  };
};

module.exports = {
  getCollections,
  getCollectionById,
  getCollectionByTitle,
  createCollection,
  updateCollection,
  deleteCollection,
  addCardToCollection: addCardToCollectionSecure,
  removeCardFromCollection: removeCardFromCollectionSecure,
  getCollectionsByUser,
  getMyCollections,
  debugCollection,
  toggleLike,
  toggleFavoriteNew,
  getCollectionStatistics,
  getUserCollectionInteraction,
  getUserFavoriteCollectionsNew,
};


