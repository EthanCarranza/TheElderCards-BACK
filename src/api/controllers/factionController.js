const { HTTP_RESPONSES } = require("../models/httpResponses");
const Faction = require("../models/faction");
const mongoose = require("mongoose");

const createFaction = async (req, res, next) => {
  try {
    const faction = new Faction(req.body);
    const savedFaction = await faction.save();
    return res.status(HTTP_RESPONSES.CREATED).json(savedFaction);
  } catch (error) {
    console.log(error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR.code)
      .json(HTTP_RESPONSES.INTERNAL_SERVER_ERROR.message);
  }
};

const getFactions = async (req, res, next) => {
  try {
    const factions = await Faction.find();
    return res.status(HTTP_RESPONSES.OK).json(factions);
  } catch (error) {
    console.log(error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR.code)
      .json(HTTP_RESPONSES.INTERNAL_SERVER_ERROR.message);
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
    console.log(error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR.code)
      .json(HTTP_RESPONSES.INTERNAL_SERVER_ERROR.message);
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
    console.log(error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR.code)
      .json(HTTP_RESPONSES.INTERNAL_SERVER_ERROR.message);
  }
};

const updateFaction = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(HTTP_RESPONSES.BAD_REQUEST).json("ID inválido");
    }
    const updatedFaction = await Faction.findByIdAndUpdate(id, req.body, {
      new: true,
    });
    if (updatedFaction) {
      return res.status(HTTP_RESPONSES.OK).json(updatedFaction);
    }
    return res.status(HTTP_RESPONSES.NOT_FOUND).json("Facción no encontrada");
  } catch (error) {
    console.log(error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR.code)
      .json(HTTP_RESPONSES.INTERNAL_SERVER_ERROR.message);
  }
};

const deleteFaction = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(HTTP_RESPONSES.BAD_REQUEST).json("ID inválido");
    }
    const deletedFaction = await Faction.findByIdAndDelete(id);
    if (deletedFaction) {
      return res.status(HTTP_RESPONSES.OK).json("Facción eliminada");
    }
    return res.status(HTTP_RESPONSES.NOT_FOUND).json("Facción no encontrada");
  } catch (error) {
    console.log(error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR.code)
      .json(HTTP_RESPONSES.INTERNAL_SERVER_ERROR.message);
  }
};

module.exports = {
  createFaction,
  getFactions,
  getFactionById,
  updateFaction,
  deleteFaction,
};
