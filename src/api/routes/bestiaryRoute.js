const express = require("express");
const router = express.Router();
const {
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
} = require("../controllers/bestiaryController");

const fileUpload = require("express-fileupload");
const { isAdmin } = require("../../middlewares/auth");

router.post("/upload-bestiary", isAdmin, fileUpload(), uploadBestiary);

router.get("/creatures", getCreatures);
router.get("/creatures/:id", getCreatureById);
router.get("/creatures/categories", getCreatureCategories);
router.get("/creatures/species", getCreatureSpecies);
router.get("/creatures/types", getCreatureTypes);
router.get("/creatures/elements", getCreatureElements);

router.get("/artifacts", getArtifacts);

router.get("/spells/for-creature", getSpellsForCreature);
router.get("/spells/for-artifact", getSpellsForArtifact);

module.exports = router;
