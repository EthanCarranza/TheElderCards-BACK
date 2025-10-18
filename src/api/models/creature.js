const mongoose = require("mongoose");

const creatureSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, required: true },
    type: { type: String, required: true },
    species: { type: String, required: true },
    element: { type: String, required: true },
    territory: { type: [String], required: true },
    attack: { type: Number, min: 0, max: 10, required: true },
    defense: { type: Number, min: 1, max: 10, required: true },
    cost: { type: Number, min: 0, max: 10, required: true },
    health: { type: Number, required: true },
    magic: { type: Number, required: true },
    stamina: { type: Number, required: true },
    img: { type: String, trim: true, required: true },
  },
  {
    collection: "creatures",
  }
);

module.exports = mongoose.model("Creature", creatureSchema);
