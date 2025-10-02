const mongoose = require("mongoose");

const collectionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: false, trim: true },
    img: { type: String, trim: true, required: false },
    creator: { type: String, required: true },
    cards: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Card",
      },
    ],
  },
  {
    collection: "collections",
  }
);

const Collection = mongoose.model("Collection", collectionSchema);
module.exports = Collection;
