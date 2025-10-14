require("dotenv").config();
const express = require("express");
const http = require("http");
const { connectDB } = require("./src/config/dataBase");
const { initializeSocket } = require("./src/config/socket");
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
const server = http.createServer(app);

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
app.use("/api/v1/card-interactions", cardInteractionRouter);
app.use("/api/v1/friendships", friendshipRouter);
app.use("/api/v1/messages", messageRouter);

// Health check endpoint
app.get("/api/health", async (req, res) => {
  try {
    const mongoose = require("mongoose");
    const Card = require("./src/api/models/card");
    const Faction = require("./src/api/models/faction");

    const dbStatus =
      mongoose.connection.readyState === 1 ? "connected" : "disconnected";
    const cardCount = await Card.countDocuments();
    const factionCount = await Faction.countDocuments();

    res.json({
      status: "OK",
      database: dbStatus,
      collections: {
        cards: cardCount,
        factions: factionCount,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: "ERROR",
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Inicializar Socket.IO
const io = initializeSocket(server);

app.use("*", (req, res, next) => {
  return res.status(404).json("Route Not Found");
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log("Socket.IO initialized");
});
