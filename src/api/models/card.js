const mongoose = require("mongoose");

const cardSchema = new mongoose.Schema(
  {
    img: { type: String, trim: true, required: true }, //ya compuesta
    title: { type: String, required: true },
    description: { type: String, required: true },
    type: {
      type: String,
      enum: ["Creature", "Artifact", "Spell"],
      required: true,
    },
    cost: { type: Number, min: 0, max: 10, required: true },
    attack: {
      type: Number,
      min: 0,
      max: 10,
      required: function () {
        return this.type === "Creature";
      },
    },
    defense: {
      type: Number,
      min: 1,
      max: 10,
      required: function () {
        return this.type === "Creature";
      },
    },
    faction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Faction",
      required: true,
    },
    creator: { type: String, required: true },
    date: { type: Date, required: true },
  },
  {
    collection: "cards",
  }
);

const Card = mongoose.model("Card", cardSchema);
module.exports = Card;
