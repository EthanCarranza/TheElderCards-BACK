const { HTTP_RESPONSES, HTTP_MESSAGES } = require("../models/httpResponses");
const Faction = require("../models/faction");
const mongoose = require("mongoose");

const createFaction = async (req, res, next) => {
  try {
    const title = (req.body.title || "").trim();
    const description = (req.body.description || "").trim();
    const territory = (req.body.territory || "").trim();
    const color = (req.body.color || "").trim();

    if (!title || !description || !territory || !color) {
      return res.status(HTTP_RESPONSES.BAD_REQUEST).json({
        message: "Todos los campos son obligatorios y no pueden estar vacíos",
      });
    }

    const nameExists = await Faction.findOne({ title });
    if (nameExists) {
      return res
        .status(HTTP_RESPONSES.CONFLICT)
        .json({ message: "Ya existe una facción con ese nombre" });
    }

    const colorExists = await Faction.findOne({ color });
    if (colorExists) {
      return res
        .status(HTTP_RESPONSES.CONFLICT)
        .json({ message: "Ya existe una facción con ese color" });
    }

    const factionData = {
      title,
      description,
      territory,
      color,
      img: req.file ? req.file.path : null,
    };

    const faction = new Faction(factionData);
    const savedFaction = await faction.save();
    return res.status(HTTP_RESPONSES.CREATED).json(savedFaction);
  } catch (error) {
    console.error("Error al crear facción:", error);
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
    console.error("Error al obtener facciones:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const getFactionById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Id de facción requerido" });
    } else if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Id de facción inválido" });
    }

    const faction = await Faction.findById(id);
    if (faction) {
      return res.status(HTTP_RESPONSES.OK).json(faction);
    }
    return res
      .status(HTTP_RESPONSES.NOT_FOUND)
      .json({ message: "Facción no encontrada" });
  } catch (error) {
    console.error("Error al obtener facción por Id:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const getFactionByName = async (req, res, next) => {
  try {
    const { name } = req.params;
    if (!name) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Nombre faltante" });
    }
    const faction = await Faction.findOne({ name });
    if (faction) {
      return res.status(HTTP_RESPONSES.OK).json(faction);
    }
    return res
      .status(HTTP_RESPONSES.NOT_FOUND)
      .json({ message: "Facción no encontrada" });
  } catch (error) {
    console.error("Error al obtener facción por nombre:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const updateFaction = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Id de facción requerido" });
    } else if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Id de facción inválido" });
    }

    const faccion = await Faction.findById(id);
    if (!faccion) {
      return res
        .status(HTTP_RESPONSES.NOT_FOUND)
        .json({ message: "Facción no encontrada" });
    }

    const title =
      req.body.title !== undefined ? req.body.title.trim() : undefined;
    const description =
      req.body.description !== undefined
        ? req.body.description.trim()
        : undefined;
    const territory =
      req.body.territory !== undefined ? req.body.territory.trim() : undefined;
    const color =
      req.body.color !== undefined ? req.body.color.trim() : undefined;

    if (
      (title !== undefined && !title) ||
      (description !== undefined && !description) ||
      (territory !== undefined && !territory) ||
      (color !== undefined && !color)
    ) {
      return res.status(HTTP_RESPONSES.BAD_REQUEST).json({
        message: "Todos los campos son obligatorios y no pueden estar vacíos",
      });
    }

    const updateData = {};
    if (title !== undefined && title !== faccion.title) {
      const nameExists = await Faction.findOne({ title });
      if (nameExists && nameExists._id.toString() !== id.toString()) {
        return res
          .status(HTTP_RESPONSES.CONFLICT)
          .json({ message: "Ya existe una facción con ese nombre" });
      }
      updateData.title = title;
    }
    if (description !== undefined) updateData.description = description;
    if (territory !== undefined) updateData.territory = territory;
    if (color !== undefined && color !== faccion.color) {
      const colorExists = await Faction.findOne({ color });
      if (colorExists && colorExists._id.toString() !== id.toString()) {
        return res
          .status(HTTP_RESPONSES.CONFLICT)
          .json({ message: "Ya existe una facción con ese color" });
      }
      updateData.color = color;
    }
    if (req.body.img !== undefined) updateData.img = req.body.img;
    if (req.file && req.file.path) updateData.img = req.file.path;

    if (Object.keys(updateData).length === 0) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "No se proporcionaron campos para actualizar" });
    }

    const updatedFaction = await Faction.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });
    if (updatedFaction) {
      return res.status(HTTP_RESPONSES.OK).json(updatedFaction);
    }
    return res
      .status(HTTP_RESPONSES.NOT_FOUND)
      .json({ message: "Facción no encontrada" });
  } catch (error) {
    console.error("Error al actualizar facción:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const deleteFaction = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Id de facción requerido" });
    } else if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Id de facción inválido" });
    }

    const faction = await Faction.findById(id);
    if (!faction) {
      return res
        .status(HTTP_RESPONSES.NOT_FOUND)
        .json({ message: "Facción no encontrada" });
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
    console.error("Error al eliminar facción:", error);
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
