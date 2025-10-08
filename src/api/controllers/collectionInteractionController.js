const Collection = require("../models/collection");
const CollectionInteraction = require("../models/collectionInteraction");
const User = require("../models/user");
const { HTTP_RESPONSES, HTTP_MESSAGES } = require("../models/httpResponses");

const toggleLike = async (req, res) => {
  try {
    const { collectionId } = req.params;
    const userId = req.user.id;

    if (!collectionId) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "ID de colección requerido" });
    }

    const collection = await Collection.findById(collectionId);
    if (!collection) {
      return res
        .status(HTTP_RESPONSES.NOT_FOUND)
        .json({ message: "Colección no encontrada" });
    }

    let interaction = await CollectionInteraction.findOne({ userId, collectionId });

    if (!interaction) {
      interaction = new CollectionInteraction({ userId, collectionId });
    }

    const newLikedState = !interaction.liked;
    interaction.liked = newLikedState;
    interaction.likedAt = newLikedState ? new Date() : null;

    await interaction.save();

    const stats = await getCollectionStats(collectionId);

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

const toggleFavorite = async (req, res) => {
  try {
    const { collectionId } = req.params;
    const userId = req.user.id;

    if (!collectionId) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "ID de colección requerido" });
    }

    const collection = await Collection.findById(collectionId);
    if (!collection) {
      return res
        .status(HTTP_RESPONSES.NOT_FOUND)
        .json({ message: "Colección no encontrada" });
    }

    let interaction = await CollectionInteraction.findOne({ userId, collectionId });

    if (!interaction) {
      interaction = new CollectionInteraction({ userId, collectionId });
    }

    const newFavoritedState = !interaction.favorited;
    interaction.favorited = newFavoritedState;
    interaction.favoritedAt = newFavoritedState ? new Date() : null;

    await interaction.save();

    const stats = await getCollectionStats(collectionId);

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
    const { collectionId } = req.params;

    if (!collectionId) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "ID de colección requerido" });
    }

    const stats = await getCollectionStats(collectionId);
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
    const { collectionId } = req.params;
    const userId = req.user.id;

    const interaction = await CollectionInteraction.findOne({ userId, collectionId });

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

const getUserFavoriteCollections = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    let favoriteInteractions;
    try {
      favoriteInteractions = await CollectionInteraction.find({
        userId,
        favorited: true,
      })
        .populate({
          path: "collectionId",
          populate: { path: "cards" },
        })
        .sort({ favoritedAt: -1 })
        .skip(skip)
        .limit(limit);
    } catch (error) {
      console.warn("Populate failed in getUserFavoriteCollections:", error.message);
      favoriteInteractions = await CollectionInteraction.find({
        userId,
        favorited: true,
      })
        .sort({ favoritedAt: -1 })
        .skip(skip)
        .limit(limit);
    }

    const collections = favoriteInteractions.map((interaction) => interaction.collectionId);
    const total = await CollectionInteraction.countDocuments({
      userId,
      favorited: true,
    });

    return res.status(HTTP_RESPONSES.OK).json({
      collections,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
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
  toggleLike,
  toggleFavorite,
  getCollectionStatistics,
  getUserCollectionInteraction,
  getUserFavoriteCollections,
};