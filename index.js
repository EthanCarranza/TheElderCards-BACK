require("dotenv").config();
const express = require("express");
const { connectDB } = require("./src/config/dataBase");
const usersRouter = require("./src/api/routes/userRoute");
const cardsRouter = require("./src/api/routes/cardRoute");
const collectionRouter = require("./src/api/routes/collectionRoute");
const factionsRouter = require("./src/api/routes/factionRoute");

const cloudinary = require("cloudinary").v2;
const cors = require("cors");
const app = express();

connectDB();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  api_key: process.env.CLOUDINARY_API_KEY,
});

app.use(cors());
app.use(express.json());

app.use("/api/v1/users", usersRouter);
app.use("/api/v1/cards", cardsRouter);
app.use("/api/v1/collections", collectionRouter);
app.use("/api/v1/factions", factionsRouter);

app.use("*", (req, res, next) => {
  return res.status(404).json("Route Not Found");
});

app.listen(4200, () => {
  console.log("Server is running on port 4200");
});
