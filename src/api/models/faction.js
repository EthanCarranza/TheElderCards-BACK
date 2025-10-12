const mongoose = require("mongoose");

const factionSchema = new mongoose.Schema(
  {
    img: { type: String, trim: true },
    title: { type: String, required: true },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: [1000, "La descripción no puede superar los 1000 caracteres"],
    },
    territory: { type: String, required: true },
    color: { type: String, required: true },
  },
  {
    collection: "factions",
  }
);

const Faction = mongoose.model("Faction", factionSchema);
module.exports = Faction;
