const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const profileStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "ProfileImages",
    allowedFormats: ["jpg", "png", "jpeg", "gif", "webp"],
  },
});

const cardStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "Cards",
    allowedFormats: ["jpg", "png", "jpeg", "gif", "webp"],
  },
});

const collectionStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "Collections",
    allowedFormats: ["jpg", "png", "jpeg", "gif", "webp"],
  },
});

const factionStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "Factions",
    allowedFormats: ["jpg", "png", "jpeg", "gif", "webp"],
  },
});

const uploadProfile = multer({ storage: profileStorage });
const uploadCard = multer({ storage: cardStorage });
const uploadCollection = multer({ storage: collectionStorage });
const uploadFaction = multer({ storage: factionStorage });

module.exports = {
  uploadProfile,
  uploadCard,
  uploadCollection,
  uploadFaction,
};
