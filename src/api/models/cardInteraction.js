const mongoose = require("mongoose");

const cardInteractionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    cardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Card",
      required: true,
    },
    liked: {
      type: Boolean,
      default: false,
    },
    favorited: {
      type: Boolean,
      default: false,
    },
    likedAt: {
      type: Date,
    },
    favoritedAt: {
      type: Date,
    },
  },
  {
    collection: "cardinteractions",
    timestamps: true,
  }
);

// Índice único para evitar duplicados de usuario-carta
cardInteractionSchema.index({ userId: 1, cardId: 1 }, { unique: true });

const CardInteraction = mongoose.model("CardInteraction", cardInteractionSchema);
module.exports = CardInteraction;