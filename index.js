require("dotenv").config();
const express = require("express");
const { connectDB } = require("./src/config/dataBase");
const usersRouter = require("./src/api/routes/userRoute");
const cardsRouter = require("./src/api/routes/cardRoute");
const collectionRouter = require("./src/api/routes/collectionRoute");
const factionsRouter = require("./src/api/routes/factionRoute");
const cardInteractionRouter = require("./src/api/routes/cardInteractionRoute");
const friendshipRouter = require("./src/api/routes/friendshipRoute");
const messageRouter = require("./src/api/routes/messageRoute");

const cloudinary = require("cloudinary").v2;
const cors = require("cors");
const app = express();

connectDB();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  api_key: process.env.CLOUDINARY_API_KEY,
});

const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:5173",
  process.env.FRONTEND_PROD_URL,
].filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());

app.use("/api/v1/users", usersRouter);
app.use("/api/v1/cards", cardsRouter);
app.use("/api/v1/collections", collectionRouter);
app.use("/api/v1/factions", factionsRouter);
app.use("/api/v1/card-interactions", cardInteractionRouter);
app.use("/api/v1/friendships", friendshipRouter);
app.use("/api/v1/messages", messageRouter);

app.use("*", (req, res, next) => {
  return res.status(404).json("Route Not Found");
});

const PORT = process.env.PORT || 4200;

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

module.exports = app;
