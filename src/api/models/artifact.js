const mongoose = require("mongoose");

const artifactSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    type: { type: String, required: true },
    element: { type: String },
    creatureType: { type: String },
    spellType: { type: String, required: true },
    effect: { type: String, required: true },
    cost: { type: Number, required: true },
  },
  {
    collection: "artifacts",
  }
);

module.exports = mongoose.model("Artifact", artifactSchema);
