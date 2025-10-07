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

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error("[Middleware] DB connection failed:", error);
    res.status(500).json({ error: "Database connection failed", message: error.message });
  }
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  api_key: process.env.CLOUDINARY_API_KEY,
});

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 200
  })
);
app.use(express.json());

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.get("/", (req, res) => {
  res.json({ 
    message: "The Elder Cards API is running", 
    timestamp: new Date().toISOString(),
    version: "1.0.0"
  });
});

app.get("/api/v1/health", async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const dbStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
    
    if (dbStatus === "connected") {
      const testQuery = await mongoose.connection.db.admin().ping();
    }
    
    res.json({ 
      status: "OK", 
      timestamp: new Date().toISOString(),
      database: dbStatus,
      mongoose: mongoose.version
    });
  } catch (error) {
    console.error("[Health] DB Error:", error);
    res.status(500).json({
      status: "ERROR",
      timestamp: new Date().toISOString(),
      database: "error",
      error: error.message
    });
  }
});

app.use((err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err);
  res.status(500).json({ 
    error: "Internal Server Error", 
    message: err.message,
    path: req.path 
  });
});

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

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

module.exports = app;
