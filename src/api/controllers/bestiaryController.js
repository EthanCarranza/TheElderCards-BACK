const Creature = require("../models/creature");
const Spell = require("../models/spell");
const Artifact = require("../models/artifact");
const {
  deleteImageFromCloudinary,
  renameImageInCloudinary,
  getImagesInFolder,
  uploadImageToCloudinary,
} = require("../../utils/cloudinaryHelper");
const XLSX = require("xlsx");
const ExcelRowParser = require("../../utils/ExcelRowParser");
const AdmZip = require("adm-zip");
const { HTTP_RESPONSES, HTTP_MESSAGES } = require("../models/httpResponses");

const uploadBestiary = async (req, res) => {
  try {
    const excelFile = req.files["excel"];
    const zipFile = req.files["zip"];
    if (!excelFile) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Excel es requerido" });
    }
    if (!zipFile) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Archivo ZIP es requerido" });
    }

    let creatures, spells, artifacts, imageMap;
    try {
      const workbook = XLSX.read(excelFile.data, { type: "buffer" });
      const creaturesSheet = workbook.Sheets["Creatures"];
      const spellsSheet = workbook.Sheets["Spells"];
      const artifactsSheet = workbook.Sheets["Artifacts"];
      if (!creaturesSheet || !spellsSheet || !artifactsSheet) {
        return res
          .status(HTTP_RESPONSES.BAD_REQUEST)
          .json({ message: "Faltan hojas en el Excel" });
      }
      const zip = new AdmZip(zipFile.data);
      const zipEntries = zip.getEntries();
      imageMap = {};
      zipEntries.forEach((entry) => {
        if (!entry.isDirectory) {
          imageMap[entry.entryName] = entry;
        }
      });
      const requiredCreatureFields = Object.entries(Creature.schema.paths)
        .filter(([key, schemaType]) => schemaType.options.required)
        .map(([key]) => key);

      const requiredSpellFields = Object.entries(Spell.schema.paths)
        .filter(([key, schemaType]) => schemaType.options.required)
        .map(([key]) => key);

      const requiredArtifactFields = Object.entries(Artifact.schema.paths)
        .filter(([key, schemaType]) => schemaType.options.required)
        .map(([key]) => key);

      creatures = ExcelRowParser.parseSheet(
        creaturesSheet,
        "creature",
        imageMap,
        requiredCreatureFields
      );
      if (creatures.length > 500) {
        throw new Error("Demasiadas criaturas (máx 500)");
      }
      spells = ExcelRowParser.parseSheet(
        spellsSheet,
        "spell",
        imageMap,
        requiredSpellFields
      );
      if (spells.length > 500) {
        throw new Error("Demasiados hechizos (máx 500)");
      }
      artifacts = ExcelRowParser.parseSheet(
        artifactsSheet,
        "artifact",
        imageMap,
        requiredArtifactFields
      );
      if (artifacts.length > 500) {
        throw new Error("Demasiados artefactos (máx 500)");
      }
    } catch (parseErr) {
      console.error("Error al procesar Excel o ZIP:", parseErr);
      return res.status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR).json({
        message: "Error al procesar Excel o ZIP: " + parseErr.message,
      });
    }
    let backupResources = [];
    try {
      const resources = await getImagesInFolder("Creatures/", 500);
      backupResources = resources;
      for (const resource of resources) {
        const backupId = resource.public_id.replace(
          "Creatures/",
          "Creatures_backup/"
        );
        await renameImageInCloudinary(resource.public_id, backupId);
      }
    } catch (error) {
      console.error(
        "No se pudieron mover imágenes a backup en Cloudinary:",
        error
      );
      return res
        .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
        .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
    }

    let creatureDocs = [];
    let uploadError = null;
    try {
      // TEMPORAL: Si varias criaturas tienen el mismo nombre de imagen, solo se sube una vez y se reutiliza la URL.
      // En el producto final, cada criatura debe tener una imagen distinta en el Excel.
      const imgUrlCache = {};
      creatureDocs = [];
      for (const creature of creatures) {
        let imageUrl = "";
        if (creature.img && imageMap[creature.img]) {
          if (imgUrlCache[creature.img]) {
            imageUrl = imgUrlCache[creature.img];
          } else {
            try {
              const imageBuffer = imageMap[creature.img].getData();
              const base64Image = `data:image/png;base64,${imageBuffer.toString(
                "base64"
              )}`;
              imageUrl = await uploadImageToCloudinary(base64Image, {
                folder: "Creatures",
                resource_type: "image",
              });
              imgUrlCache[creature.img] = imageUrl;
            } catch (error) {
              console.error(
                `Error subiendo imagen ${creature.img} a Cloudinary:`,
                error
              );
              throw error;
            }
          }
        }
        creatureDocs.push({ ...creature, img: imageUrl });
      }
    } catch (error) {
      uploadError = error;
    }

    if (uploadError) {
      try {
        console.error(
          "Error al subir imágenes, restaurando desde backup:",
          uploadError
        );
        const newImages = await getImagesInFolder("Creatures/", 500);
        for (const resource of newImages) {
          await deleteImageFromCloudinary(resource.secure_url);
        }
      } catch (error) {
        console.error("Error eliminando imágenes nuevas:", error);
      }
      try {
        const backupImages = await getImagesInFolder("Creatures_backup/", 500);
        for (const resource of backupImages) {
          const originalId = resource.public_id.replace(
            "Creatures_backup/",
            "Creatures/"
          );
          await renameImageInCloudinary(resource.public_id, originalId);
        }
      } catch (error) {
        console.error(
          "No se pudieron mover imágenes de backup a origen en Cloudinary:",
          error
        );
        return res
          .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
          .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
      }
    } else {
      try {
        const backupImages = await getImagesInFolder("Creatures_backup/", 500);
        for (const resource of backupImages) {
          await deleteImageFromCloudinary(resource.secure_url);
        }
      } catch (error) {
        console.error("No se pudieron eliminar imágenes de backup:", error);
      }

      await Creature.deleteMany({});
      await Spell.deleteMany({});
      await Artifact.deleteMany({});

      await Creature.insertMany(creatureDocs);
      await Spell.insertMany(spells);
      await Artifact.insertMany(artifacts);

      return res
        .status(HTTP_RESPONSES.CREATED)
        .json({ message: "Bestiario subido y procesado" });
    }
  } catch (error) {
    console.error("Error al cargar bestiario:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const getCreatures = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      sort,
      category,
      type,
      species,
      element,
    } = req.query;
    const query = {};
    if (category) query.category = category;
    if (type) query.type = type;
    if (species) query.species = species;
    if (element) query.element = element;

    let sortObj = {};
    if (sort) {
      let [field, direction] = sort.split("_");
      sortObj[field] = direction === "desc" ? -1 : 1;
    } else {
      sortObj["name"] = 1;
    }

    const total = await Creature.countDocuments(query);
    const creatures = await Creature.find(query, null, {
      skip: (parseInt(page) - 1) * parseInt(limit),
      limit: parseInt(limit),
      sort: sortObj,
    });
    return res.status(HTTP_RESPONSES.OK).json({
      creatures,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (error) {
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const getCreatureById = async (req, res, next) => {
  try {
    const creature = await Creature.findById(req.params.id);
    if (!creature) {
      return res
        .status(HTTP_RESPONSES.NOT_FOUND)
        .json({ message: "Criatura no encontrada" });
    }
    return res.status(HTTP_RESPONSES.OK).json(creature);
  } catch (error) {
    console.error("Error al obtener criatura por Id:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const getCreatureCategories = async (req, res) => {
  try {
    const categories = await Creature.distinct("category");
    return res.status(HTTP_RESPONSES.OK).json(categories);
  } catch (error) {
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const getCreatureSpecies = async (req, res) => {
  try {
    const species = await Creature.distinct("species");
    return res.status(HTTP_RESPONSES.OK).json(species);
  } catch (error) {
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const getCreatureTypes = async (req, res) => {
  try {
    const types = await Creature.distinct("type");
    return res.status(HTTP_RESPONSES.OK).json(types);
  } catch (error) {
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const getCreatureElements = async (req, res) => {
  try {
    const elements = await Creature.distinct("element");
    return res.status(HTTP_RESPONSES.OK).json(elements);
  } catch (error) {
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const getArtifacts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      sort,
      type,
      element,
      creatureType,
      spellType,
    } = req.query;
    const query = {};
    if (type) query.type = type;
    if (element) query.element = element;
    if (creatureType) query.creatureType = creatureType;
    if (spellType) query.spellType = spellType;

    let sortObj = {};
    if (sort) {
      let [field, direction] = sort.split("_");
      sortObj[field] = direction === "desc" ? -1 : 1;
    } else {
      sortObj["cost"] = 1;
    }

    const total = await Artifact.countDocuments(query);
    const artifacts = await Artifact.find(query, null, {
      skip: (parseInt(page) - 1) * parseInt(limit),
      limit: parseInt(limit),
      sort: sortObj,
    });
    return res.status(HTTP_RESPONSES.OK).json({
      artifacts,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (error) {
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const getSpellsForCreature = async (req, res) => {
  try {
    const { type, element, category } = req.query;
    const query = {};
    if (type) {
      if (type.toLowerCase() === "común" || type.toLowerCase() === "natural") {
        query.discipline = "Natural";
      } else {
        query.discipline = type;
      }
    }
    if (element) query.element = element;
    if (category) query.creatureCategory = category;

    const spells = await Spell.find(query);
    return res.status(HTTP_RESPONSES.OK).json(spells);
  } catch (error) {
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const getSpellsForArtifact = async (req, res) => {
  try {
    const { element, creatureType, spellType } = req.query;
    const query = {};
    if (element) query.element = element;
    if (creatureType) query.creatureType = creatureType;
    if (spellType) query.spellType = spellType;

    const spells = await Spell.find(query);
    return res.status(HTTP_RESPONSES.OK).json(spells);
  } catch (error) {
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

module.exports = {
  uploadBestiary,
  getCreatures,
  getCreatureById,
  getCreatureCategories,
  getCreatureSpecies,
  getCreatureTypes,
  getCreatureElements,
  getArtifacts,
  getSpellsForCreature,
  getSpellsForArtifact,
};
