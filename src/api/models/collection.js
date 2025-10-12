const mongoose = require("mongoose");

const collectionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "La descripción no puede superar los 1000 caracteres"],
    },
    img: { type: String, trim: true },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    isPrivate: { type: Boolean, default: false },
    cards: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Card",
      },
    ],
  },
  {
    collection: "collections",
    timestamps: true,
  }
);

const Collection = mongoose.model("Collection", collectionSchema);
module.exports = Collection;
