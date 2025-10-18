const mongoose = require("mongoose");

const spellSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    type: { type: String, required: true },
    discipline: { type: String, required: true },
    element: { type: String, required: true },
    creatureCategory: { type: String },
    effect: { type: String, required: true },
    cost: { type: Number, required: true },
  },
  {
    collection: "spells",
  }
);

module.exports = mongoose.model("Spell", spellSchema);
