const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");


const userStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "users",
    allowedFormats: ["jpg", "png", "jpeg", "gif", "webp"],
  },
});

const cardStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "cards",
    allowedFormats: ["jpg", "png", "jpeg", "gif", "webp"],
  },
});

const collectionStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "collections",
    allowedFormats: ["jpg", "png", "jpeg", "gif", "webp"],
  },
});

const factionStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "factions",
    allowedFormats: ["jpg", "png", "jpeg", "gif", "webp"],
  },
});

const tempStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "temp",
    allowedFormats: ["jpg", "png", "jpeg", "gif", "webp"],
  },
});

const uploadUser = multer({ storage: userStorage });
const uploadCard = multer({ storage: cardStorage });
const uploadCollection = multer({ storage: collectionStorage });
const uploadFaction = multer({ storage: factionStorage });
const uploadTemp = multer({ storage: tempStorage });

module.exports = {
  uploadUser,
  uploadCard,
  uploadCollection,
  uploadFaction,
  uploadTemp,
};
