const Card = require("../models/card");
const CardInteraction = require("../models/cardInteraction");
const User = require("../models/user");
const { HTTP_RESPONSES, HTTP_MESSAGES } = require("../models/httpResponses");

// Toggle like en una carta
const toggleLike = async (req, res) => {
  try {
    const { cardId } = req.params;
    const userId = req.user.id;

    if (!cardId) {
      return res.status(HTTP_RESPONSES.BAD_REQUEST).json({ message: "ID de carta requerido" });
    }

    // Verificar que la carta existe
    const card = await Card.findById(cardId);
    if (!card) {
      return res.status(HTTP_RESPONSES.NOT_FOUND).json({ message: "Carta no encontrada" });
    }

    // Buscar o crear interacción
    let interaction = await CardInteraction.findOne({ userId, cardId });
    
    if (!interaction) {
      interaction = new CardInteraction({ userId, cardId });
    }

    // Toggle like
    const newLikedState = !interaction.liked;
    interaction.liked = newLikedState;
    interaction.likedAt = newLikedState ? new Date() : null;

    await interaction.save();

    // Obtener estadísticas actualizadas
    const stats = await getCardStats(cardId);

    return res.status(HTTP_RESPONSES.OK).json({
      liked: newLikedState,
      stats
    });
  } catch (error) {
    console.error("Error al actualizar like:", error);
    return res.status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR).json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

// Toggle favorito en una carta
const toggleFavorite = async (req, res) => {
  try {
    const { cardId } = req.params;
    const userId = req.user.id;

    if (!cardId) {
      return res.status(HTTP_RESPONSES.BAD_REQUEST).json({ message: "ID de carta requerido" });
    }

    // Verificar que la carta existe
    const card = await Card.findById(cardId);
    if (!card) {
      return res.status(HTTP_RESPONSES.NOT_FOUND).json({ message: "Carta no encontrada" });
    }

    // Buscar o crear interacción
    let interaction = await CardInteraction.findOne({ userId, cardId });
    
    if (!interaction) {
      interaction = new CardInteraction({ userId, cardId });
    }

    // Toggle favorite
    const newFavoritedState = !interaction.favorited;
    interaction.favorited = newFavoritedState;
    interaction.favoritedAt = newFavoritedState ? new Date() : null;

    await interaction.save();

    // Obtener estadísticas actualizadas
    const stats = await getCardStats(cardId);

    return res.status(HTTP_RESPONSES.OK).json({
      favorited: newFavoritedState,
      stats
    });
  } catch (error) {
    console.error("Error al actualizar favorito:", error);
    return res.status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR).json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

// Obtener estadísticas de una carta
const getCardStatistics = async (req, res) => {
  try {
    const { cardId } = req.params;

    if (!cardId) {
      return res.status(HTTP_RESPONSES.BAD_REQUEST).json({ message: "ID de carta requerido" });
    }

    const stats = await getCardStats(cardId);
    return res.status(HTTP_RESPONSES.OK).json(stats);
  } catch (error) {
    console.error("Error al obtener estadísticas:", error);
    return res.status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR).json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

// Obtener interacciones del usuario con una carta
const getUserCardInteraction = async (req, res) => {
  try {
    const { cardId } = req.params;
    const userId = req.user.id;

    const interaction = await CardInteraction.findOne({ userId, cardId });
    
    return res.status(HTTP_RESPONSES.OK).json({
      liked: interaction?.liked || false,
      favorited: interaction?.favorited || false
    });
  } catch (error) {
    console.error("Error al obtener interacción:", error);
    return res.status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR).json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

// Obtener cartas favoritas del usuario
const getUserFavoriteCards = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const favoriteInteractions = await CardInteraction.find({
      userId,
      favorited: true
    })
      .populate({
        path: "cardId",
        populate: { path: "faction" }
      })
      .sort({ favoritedAt: -1 })
      .skip(skip)
      .limit(limit);

    const cards = favoriteInteractions.map(interaction => interaction.cardId);
    const total = await CardInteraction.countDocuments({
      userId,
      favorited: true
    });

    return res.status(HTTP_RESPONSES.OK).json({
      cards,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error("Error al obtener cartas favoritas:", error);
    return res.status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR).json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

// Función auxiliar para obtener estadísticas de una carta
const getCardStats = async (cardId) => {
  const [likesCount, favoritesCount] = await Promise.all([
    CardInteraction.countDocuments({ cardId, liked: true }),
    CardInteraction.countDocuments({ cardId, favorited: true })
  ]);

  return {
    likes: likesCount,
    favorites: favoritesCount
  };
};

module.exports = {
  toggleLike,
  toggleFavorite,
  getCardStatistics,
  getUserCardInteraction,
  getUserFavoriteCards
};