const mongoose = require("mongoose");
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.DB_URL);
    } catch (error) {
    }
}
module.exports = { connectDB }
