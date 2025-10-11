const Card = require("../models/card");
const CardInteraction = require("../models/cardInteraction");
const { HTTP_RESPONSES, HTTP_MESSAGES } = require("../models/httpResponses");

const toggleLike = async (req, res) => {
  try {
    const { cardId } = req.params;
    const userId = req.user.id;

    if (!cardId) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Id de carta requerido" });
    }

    const card = await Card.findById(cardId);
    if (!card) {
      return res
        .status(HTTP_RESPONSES.NOT_FOUND)
        .json({ message: "Carta no encontrada" });
    }

    let interaction = await CardInteraction.findOne({ userId, cardId });

    if (!interaction) {
      interaction = new CardInteraction({ userId, cardId });
    }

    const newLikedState = !interaction.liked;
    interaction.liked = newLikedState;
    interaction.likedAt = newLikedState ? new Date() : null;

    await interaction.save();

    const stats = await getCardStats(cardId);

    return res.status(HTTP_RESPONSES.OK).json({
      liked: newLikedState,
      stats,
    });
  } catch (error) {
    console.error("Error al actualizar like de carta:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const toggleFavorite = async (req, res) => {
  try {
    const { cardId } = req.params;
    const userId = req.user.id;

    if (!cardId) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Id de carta requerido" });
    }

    const card = await Card.findById(cardId);
    if (!card) {
      return res
        .status(HTTP_RESPONSES.NOT_FOUND)
        .json({ message: "Carta no encontrada" });
    }

    let interaction = await CardInteraction.findOne({ userId, cardId });

    if (!interaction) {
      interaction = new CardInteraction({ userId, cardId });
    }

    const newFavoritedState = !interaction.favorited;
    interaction.favorited = newFavoritedState;
    interaction.favoritedAt = newFavoritedState ? new Date() : null;

    await interaction.save();

    const stats = await getCardStats(cardId);

    return res.status(HTTP_RESPONSES.OK).json({
      favorited: newFavoritedState,
      stats,
    });
  } catch (error) {
    console.error("Error al actualizar favorito de carta:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const getCardStatistics = async (req, res) => {
  try {
    const { cardId } = req.params;

    if (!cardId) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Id de carta requerido" });
    }

    const stats = await getCardStats(cardId);
    return res.status(HTTP_RESPONSES.OK).json(stats);
  } catch (error) {
    console.error("Error al obtener estadísticas de carta:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const getUserCardInteraction = async (req, res) => {
  try {
    const { cardId } = req.params;
    const userId = req.user.id;

    const interaction = await CardInteraction.findOne({ userId, cardId });

    return res.status(HTTP_RESPONSES.OK).json({
      liked: interaction?.liked || false,
      favorited: interaction?.favorited || false,
    });
  } catch (error) {
    console.error("Error al obtener interacción de usuario con carta:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const getUserFavoriteCards = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    let favoriteInteractions;
    try {
      favoriteInteractions = await CardInteraction.find({
        userId,
        favorited: true,
      })
        .populate({
          path: "cardId",
          populate: { path: "faction" },
        })
        .sort({ favoritedAt: -1 })
        .skip(skip)
        .limit(limit);
    } catch (error) {
      console.warn("Populate failed in getUserFavoriteCards:", error.message);
      favoriteInteractions = await CardInteraction.find({
        userId,
        favorited: true,
      })
        .sort({ favoritedAt: -1 })
        .skip(skip)
        .limit(limit);
    }

    const cards = favoriteInteractions.map((interaction) => interaction.cardId);
    const total = await CardInteraction.countDocuments({
      userId,
      favorited: true,
    });

    return res.status(HTTP_RESPONSES.OK).json({
      cards,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (error) {
    console.error("Error al obtener cartas favoritas del usuario:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const getCardStats = async (cardId) => {
  const [likesCount, favoritesCount] = await Promise.all([
    CardInteraction.countDocuments({ cardId, liked: true }),
    CardInteraction.countDocuments({ cardId, favorited: true }),
  ]);

  return {
    likes: likesCount,
    favorites: favoritesCount,
  };
};

module.exports = {
  toggleLike,
  toggleFavorite,
  getCardStatistics,
  getUserCardInteraction,
  getUserFavoriteCards,
};
