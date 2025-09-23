const express = require("express");
const { isAdmin } = require("../../middlewares/auth");
const { uploadFaction } = require("../../middlewares/fileStorage");
const router = express.Router();
const {
  createFaction,
  getFactions,
  getFactionById,
  updateFaction,
  deleteFaction,
} = require("../controllers/factionController");

router.get("/", getFactions);
router.get("/:id", getFactionById);
router.post("/", isAdmin, uploadFaction.single("img"), createFaction);
router.put("/:id", isAdmin, uploadFaction.single("img"), updateFaction);
router.delete("/:id", isAdmin, deleteFaction);

module.exports = router;
