const mongoose = require("mongoose");

const friendshipSchema = new mongoose.Schema({
  requester: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: true,
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "accepted", "blocked"],
    default: "pending",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

friendshipSchema.index({ requester: 1, recipient: 1 }, { unique: true });

friendshipSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

friendshipSchema.statics.getFriends = async function (userId) {
  const { applySafePopulateMultiple } = require("../../utils/safePopulate");

  const query = this.find({
    $or: [
      { requester: userId, status: "accepted" },
      { recipient: userId, status: "accepted" },
    ],
  })
    .populate("requester", "username email image")
    .populate("recipient", "username email image");

  return await applySafePopulateMultiple(query);
};

friendshipSchema.statics.getPendingRequests = async function (userId) {
  const {
    applySafePopulate,
    safePopulateUser,
  } = require("../../utils/safePopulate");

  const query = this.find({
    recipient: userId,
    status: "pending",
  }).sort({ createdAt: -1 });

  return await applySafePopulate(
    query,
    safePopulateUser("requester", "username email image")
  );
};

friendshipSchema.statics.getSentRequests = async function (userId) {
  const {
    applySafePopulate,
    safePopulateUser,
  } = require("../../utils/safePopulate");

  const query = this.find({
    requester: userId,
    status: "pending",
  }).sort({ createdAt: -1 });

  return await applySafePopulate(
    query,
    safePopulateUser("recipient", "username email image")
  );
};

friendshipSchema.statics.getRelationship = function (userId1, userId2) {
  return this.findOne({
    $or: [
      { requester: userId1, recipient: userId2 },
      { requester: userId2, recipient: userId1 },
    ],
  });
};

const Friendship = mongoose.model("Friendship", friendshipSchema);
module.exports = Friendship;
