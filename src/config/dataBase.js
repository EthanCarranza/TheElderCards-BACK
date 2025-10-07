const mongoose = require("mongoose");

let isConnected = false;

const connectDB = async () => {
    if (isConnected) {
        return;
    }
    
    try {
        const opts = {
            bufferCommands: false,
        };
        
        await mongoose.connect(process.env.DB_URL, opts);
        isConnected = true;
    } catch (error) {
        throw error;
    }
}

module.exports = { connectDB }
