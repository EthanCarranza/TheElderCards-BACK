const { HTTP_RESPONSES, HTTP_MESSAGES } = require("../models/httpResponses");
const Faction = require("../models/faction");
const mongoose = require("mongoose");
const createFaction = async (req, res, next) => {
  try {
    const { title, description, territory, color } = req.body;
    if (!title || !description || !territory || !color) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Faltan datos obligatorios" });
    }
    const factionData = {
      title,
      description,
      territory,
      color,
    };
    if (req.body && req.body.img) {
      factionData.img = req.body.img;
    }
    if (req.file && req.file.path) {
      factionData.img = req.file.path;
    }
    const faction = new Faction(factionData);
    const savedFaction = await faction.save();
    return res.status(HTTP_RESPONSES.CREATED).json(savedFaction);
  } catch (error) {
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};
const getFactions = async (req, res, next) => {
  try {
    const factions = await Faction.find();
    return res.status(HTTP_RESPONSES.OK).json(factions);
  } catch (error) {
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};
const getFactionById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(HTTP_RESPONSES.BAD_REQUEST).json("ID inválido");
    }
    const faction = await Faction.findById(id);
    if (faction) {
      return res.status(HTTP_RESPONSES.OK).json(faction);
    }
    return res.status(HTTP_RESPONSES.NOT_FOUND).json("Facción no encontrada");
  } catch (error) {
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};
const getFactionByName = async (req, res, next) => {
  try {
    const { name } = req.params;
    if (!name) {
      return res.status(HTTP_RESPONSES.BAD_REQUEST).json("Nombre faltante");
    }
    const faction = await Faction.findOne({ name });
    if (faction) {
      return res.status(HTTP_RESPONSES.OK).json(faction);
    }
    return res.status(HTTP_RESPONSES.NOT_FOUND).json("Facción no encontrada");
  } catch (error) {
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};
const updateFaction = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(HTTP_RESPONSES.BAD_REQUEST).json("ID inválido");
    }
    const updateData = { ...req.body };
    if (req.file && req.file.path) {
      updateData.img = req.file.path;
    }
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === "" || updateData[key] === undefined) {
        delete updateData[key];
      }
    });
    const updatedFaction = await Faction.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });
    if (updatedFaction) {
      return res.status(HTTP_RESPONSES.OK).json(updatedFaction);
    }
    return res.status(HTTP_RESPONSES.NOT_FOUND).json("Facción no encontrada");
  } catch (error) {
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};
const deleteFaction = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(HTTP_RESPONSES.BAD_REQUEST).json("ID inválido");
    }
    const faction = await Faction.findById(id);
    if (!faction) {
      return res.status(HTTP_RESPONSES.NOT_FOUND).json("Facción no encontrada");
    }
    const Card = require("../models/card");
    const cardsUsingFaction = await Card.countDocuments({ faction: id });
    if (cardsUsingFaction > 0) {
      return res.status(HTTP_RESPONSES.BAD_REQUEST).json({
        message: `No se puede eliminar la facción. Hay ${cardsUsingFaction} carta(s) que la usan.`,
        cardsCount: cardsUsingFaction,
      });
    }
    await Faction.findByIdAndDelete(id);
    return res
      .status(HTTP_RESPONSES.OK)
      .json({ message: "Facción eliminada correctamente" });
  } catch (error) {
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};
module.exports = {
  createFaction,
  getFactions,
  getFactionById,
  updateFaction,
  deleteFaction,
};
