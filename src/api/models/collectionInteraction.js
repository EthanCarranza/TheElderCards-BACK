const mongoose = require("mongoose");

const collectionInteractionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    collectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Collection",
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
    collection: "collectioninteractions",
    timestamps: true,
  }
);

// Índice único para evitar duplicados de usuario-colección
collectionInteractionSchema.index({ userId: 1, collectionId: 1 }, { unique: true });

const CollectionInteraction = mongoose.model("CollectionInteraction", collectionInteractionSchema);
module.exports = CollectionInteraction;