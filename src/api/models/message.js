const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: true,
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: true,
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxLength: 2000,
  },
  readAt: {
    type: Date,
    default: null,
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

messageSchema.index({ sender: 1, recipient: 1, createdAt: -1 });
messageSchema.index({ recipient: 1, isRead: 1 });
messageSchema.index({ createdAt: -1 });

messageSchema.statics.getConversation = async function (
  userId1,
  userId2,
  page = 1,
  limit = 50
) {
  const { applySafePopulateMultiple } = require("../../utils/safePopulate");

  const query = this.find({
    $or: [
      { sender: userId1, recipient: userId2 },
      { sender: userId2, recipient: userId1 },
    ],
  })
    .populate("sender", "username email image")
    .populate("recipient", "username email image")
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const messages = await applySafePopulateMultiple(query);
  return messages.reverse();
};

messageSchema.statics.getUserConversations = async function (userId) {
  const conversations = await this.aggregate([
    {
      $match: {
        $or: [
          { sender: new mongoose.Types.ObjectId(userId) },
          { recipient: new mongoose.Types.ObjectId(userId) },
        ],
      },
    },
    {
      $addFields: {
        otherUser: {
          $cond: {
            if: { $eq: ["$sender", new mongoose.Types.ObjectId(userId)] },
            then: "$recipient",
            else: "$sender",
          },
        },
      },
    },
    {
      $group: {
        _id: "$otherUser",
        lastMessage: { $first: "$$ROOT" },
        unreadCount: {
          $sum: {
            $cond: {
              if: {
                $and: [
                  { $eq: ["$recipient", new mongoose.Types.ObjectId(userId)] },
                  { $eq: ["$isRead", false] },
                ],
              },
              then: 1,
              else: 0,
            },
          },
        },
      },
    },
    {
      $sort: { "lastMessage.createdAt": -1 },
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "user",
      },
    },
    {
      $match: {
        "user.0": { $exists: true },
      },
    },
    {
      $unwind: "$user",
    },
    {
      $project: {
        _id: 0,
        userId: "$_id",
        user: {
          _id: "$user._id",
          username: "$user.username",
          email: "$user.email",
          image: "$user.image",
        },
        lastMessage: {
          _id: "$lastMessage._id",
          content: "$lastMessage.content",
          createdAt: "$lastMessage.createdAt",
          sender: "$lastMessage.sender",
          isRead: "$lastMessage.isRead",
        },
        unreadCount: 1,
      },
    },
  ]);

  return conversations;
};

messageSchema.statics.markAsRead = async function (senderId, recipientId) {
  const result = await this.updateMany(
    {
      sender: senderId,
      recipient: recipientId,
      isRead: false,
    },
    {
      $set: {
        isRead: true,
        readAt: new Date(),
      },
    }
  );

  return result.modifiedCount;
};

messageSchema.statics.getUnreadCount = async function (userId) {
  const count = await this.countDocuments({
    recipient: userId,
    isRead: false,
  });

  return count;
};

module.exports = mongoose.model("Message", messageSchema);
