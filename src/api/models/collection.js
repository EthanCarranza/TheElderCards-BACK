const mongoose = require("mongoose");

const collectionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, trim: true },
    img: { type: String, trim: true },
    creator: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true 
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
