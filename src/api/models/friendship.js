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
    enum: ["pending", "accepted", "blocked", "declined"],
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
  message: {
    type: String,
    maxlength: 200,
    trim: true,
  },
});
friendshipSchema.index({ requester: 1, recipient: 1 }, { unique: true });
friendshipSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});
friendshipSchema.statics.getFriends = function(userId) {
  return this.find({
    $or: [
      { requester: userId, status: 'accepted' },
      { recipient: userId, status: 'accepted' }
    ]
  }).populate('requester', 'username email image')
    .populate('recipient', 'username email image');
};
friendshipSchema.statics.getPendingRequests = function(userId) {
  return this.find({
    recipient: userId,
    status: 'pending'
  }).populate('requester', 'username email image')
    .sort({ createdAt: -1 });
};
friendshipSchema.statics.getSentRequests = function(userId) {
  return this.find({
    requester: userId,
    status: 'pending'
  }).populate('recipient', 'username email image')
    .sort({ createdAt: -1 });
};
friendshipSchema.statics.getRelationship = function(userId1, userId2) {
  return this.findOne({
    $or: [
      { requester: userId1, recipient: userId2 },
      { requester: userId2, recipient: userId1 }
    ]
  });
};
friendshipSchema.statics.areFriends = async function(userId1, userId2) {
  const relationship = await this.getRelationship(userId1, userId2);
  return relationship && relationship.status === 'accepted';
};
friendshipSchema.methods.getStatusForUser = function(userId) {
  if (this.requester.toString() === userId.toString()) {
    return {
      status: this.status,
      role: 'requester',
      otherUser: this.recipient
    };
  } else {
    return {
      status: this.status,
      role: 'recipient',
      otherUser: this.requester
    };
  }
};
const Friendship = mongoose.model("Friendship", friendshipSchema);
module.exports = Friendship;
