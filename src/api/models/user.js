const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    image: { type: String, required: false },
    role: {
      type: String,
      required: true,
      default: "user",
      enum: ["admin", "user"],
    },
    favorites: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "cards",
      },
    ],
  },
  {
    collection: "users",
  }
);

userSchema.pre("save", function () {
  this.password = bcrypt.hashSync(this.password, 10);
});

const User = mongoose.model("users", userSchema, "users");
module.exports = User;
