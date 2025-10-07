const mongoose = require("mongoose");
const factionSchema = new mongoose.Schema(
  {
    img: { type: String, trim: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    territory: { type: String, required: true },
    color: { type: String, required: true },
  },
  {
    collection: "factions",
  }
);
const Faction = mongoose.model("Faction", factionSchema);
module.exports = Faction;
