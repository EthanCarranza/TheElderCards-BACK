const mongoose = require("mongoose");

let isConnected = false;

const connectDB = async () => {
    if (isConnected && mongoose.connection.readyState === 1) {
        return mongoose.connection;
    }
    
    try {
        if (mongoose.connection.readyState === 0) {
            const connection = await mongoose.connect(process.env.DB_URL);
            isConnected = true;
            console.log("[DB] MongoDB connected successfully");
            return connection;
        }
        return mongoose.connection;
    } catch (error) {
        console.error("[DB] Connection error:", error);
        throw error;
    }
}

module.exports = { connectDB }
