const Friendship = require("../models/friendship");
const User = require("../models/user");
const { HTTP_RESPONSES, HTTP_MESSAGES } = require("../models/httpResponses");
const {
  emitNewFriendRequest,
  emitFriendRequestResponse,
  emitPendingRequestUpdate,
} = require("../../config/socket");

const sendFriendRequest = async (req, res) => {
  try {
    const { recipientId } = req.body;
    const requesterId = req.user.id;

    if (requesterId === recipientId) {
      return res.status(HTTP_RESPONSES.BAD_REQUEST).json({
        message: "No puedes enviarte una solicitud de amistad a ti mismo",
      });
    }

    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(HTTP_RESPONSES.NOT_FOUND).json({
        message: "Usuario no encontrado",
      });
    }

    const existingRelation = await Friendship.getRelationship(
      requesterId,
      recipientId
    );
    if (existingRelation) {
      let message = "Ya existe una relación con este usuario";
      if (existingRelation.status === "pending") {
        message = "Ya hay una solicitud de amistad pendiente";
      } else if (existingRelation.status === "accepted") {
        message = "Ya son amigos";
      } else if (existingRelation.status === "blocked") {
        message = "No se puede enviar solicitud a este usuario";
      }
      return res.status(HTTP_RESPONSES.BAD_REQUEST).json({ message });
    }

    const friendship = new Friendship({
      requester: requesterId,
      recipient: recipientId,
      status: "pending",
    });

    await friendship.save();

    try {
      await friendship.populate("recipient", "username email image");
    } catch (error) {
      console.warn(
        "Recipient populate failed in sendFriendRequest:",
        error.message
      );
      const { DELETED_USER_PLACEHOLDER } = require("../../utils/safePopulate");
      if (
        !friendship.recipient ||
        (typeof friendship.recipient === "object" &&
          !friendship.recipient.username)
      ) {
        friendship.recipient = DELETED_USER_PLACEHOLDER;
      }
    }

    try {
      emitNewFriendRequest(recipientId, {
        friendshipId: friendship._id,
        requester: friendship.requester,
        message: friendship.message,
        createdAt: friendship.createdAt,
      });

      const pendingCount = await Friendship.countDocuments({
        recipient: recipientId,
        status: "pending",
      });
      emitPendingRequestUpdate(recipientId, pendingCount);
    } catch (socketError) {
      console.warn("Error emitiendo evento WebSocket:", socketError);
    }

    return res.status(HTTP_RESPONSES.CREATED).json({
      message: "Solicitud de amistad enviada",
      friendship,
    });
  } catch (error) {
    console.error("Error al enviar solicitud de amistad:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const respondFriendRequest = async (req, res) => {
  try {
    const { friendshipId } = req.params;
    const { action } = req.body;
    const userId = req.user.id;

    const friendship = await Friendship.findById(friendshipId);
    if (!friendship) {
      return res.status(HTTP_RESPONSES.NOT_FOUND).json({
        message: "Solicitud de amistad no encontrada",
      });
    }

    if (friendship.recipient.toString() !== userId) {
      return res.status(HTTP_RESPONSES.FORBIDDEN).json({
        message: "No tienes permisos para responder a esta solicitud",
      });
    }

    if (friendship.status !== "pending") {
      return res.status(HTTP_RESPONSES.BAD_REQUEST).json({
        message: "Esta solicitud ya fue procesada",
      });
    }

    if (action === "accept") {
      friendship.status = "accepted";
      await friendship.save();

      try {
        await friendship.populate("requester", "username email image");
      } catch (error) {
        console.warn(
          "Requester populate failed in respondFriendRequest:",
          error.message
        );
        const {
          DELETED_USER_PLACEHOLDER,
        } = require("../../utils/safePopulate");
        if (
          !friendship.requester ||
          (typeof friendship.requester === "object" &&
            !friendship.requester.username)
        ) {
          friendship.requester = DELETED_USER_PLACEHOLDER;
        }
      }
    } else if (action === "decline") {
      await Friendship.findByIdAndDelete(friendshipId);
    } else {
      return res.status(HTTP_RESPONSES.BAD_REQUEST).json({
        message: "Acción no válida. Usar 'accept' o 'decline'",
      });
    }

    const responseMsg =
      action === "accept"
        ? "Solicitud de amistad aceptada"
        : "Solicitud de amistad rechazada";

    try {
      emitFriendRequestResponse(
        friendship.requester._id || friendship.requester,
        {
          action,
          recipient: req.user,
          friendship,
        }
      );

      const pendingCount = await Friendship.countDocuments({
        recipient: userId,
        status: "pending",
      });
      emitPendingRequestUpdate(userId, pendingCount);
    } catch (socketError) {
      console.warn("Error emitiendo evento WebSocket:", socketError);
    }

    return res.status(HTTP_RESPONSES.OK).json({
      message: responseMsg,
      friendship,
    });
  } catch (error) {
    console.error("Error al responder solicitud de amistad:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const getFriends = async (req, res) => {
  try {
    const userId = req.user.id;
    const friends = await Friendship.getFriends(userId);

    const friendsList = friends.map((friendship) => {
      const friend =
        friendship.requester._id.toString() === userId
          ? friendship.recipient
          : friendship.requester;

      return {
        friendshipId: friendship._id,
        user: friend,
        friendsSince: friendship.updatedAt,
      };
    });

    return res.status(HTTP_RESPONSES.OK).json({
      friends: friendsList,
      count: friendsList.length,
    });
  } catch (error) {
    console.error("Error al obtener amigos:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const getPendingRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    const requests = await Friendship.getPendingRequests(userId);

    const formattedRequests = requests.map((request) => ({
      friendshipId: request._id,
      requester: request.requester,
      message: request.message,
      createdAt: request.createdAt,
    }));

    return res.status(HTTP_RESPONSES.OK).json({
      requests: formattedRequests,
      count: formattedRequests.length,
    });
  } catch (error) {
    console.error("Error al obtener solicitudes de amistad pendientes:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const getSentRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    const requests = await Friendship.getSentRequests(userId);

    const formattedRequests = requests.map((request) => ({
      friendshipId: request._id,
      recipient: request.recipient,
      message: request.message,
      createdAt: request.createdAt,
    }));

    return res.status(HTTP_RESPONSES.OK).json({
      requests: formattedRequests,
      count: formattedRequests.length,
    });
  } catch (error) {
    console.error("Error al obtener solicitudes enviadas:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const removeFriendship = async (req, res) => {
  try {
    const { friendshipId } = req.params;
    const userId = req.user.id;

    const friendship = await Friendship.findById(friendshipId);
    if (!friendship) {
      return res.status(HTTP_RESPONSES.NOT_FOUND).json({
        message: "Relación no encontrada",
      });
    }

    const isRequester = friendship.requester.toString() === userId;
    const isRecipient = friendship.recipient.toString() === userId;

    if (!isRequester && !isRecipient) {
      return res.status(HTTP_RESPONSES.FORBIDDEN).json({
        message: "No tienes permisos para eliminar esta relación",
      });
    }

    await Friendship.findByIdAndDelete(friendshipId);

    let message = "Relación eliminada";
    if (friendship.status === "pending") {
      message = isRequester ? "Solicitud cancelada" : "Solicitud eliminada";
    } else if (friendship.status === "accepted") {
      message = "Amistad eliminada";
    }

    return res.status(HTTP_RESPONSES.OK).json({ message });
  } catch (error) {
    console.error("Error al eliminar relación:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const blockUser = async (req, res) => {
  try {
    const { userId: targetUserId } = req.params;
    const userId = req.user.id;

    if (userId === targetUserId) {
      return res.status(HTTP_RESPONSES.BAD_REQUEST).json({
        message: "No puedes bloquearte a ti mismo",
      });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(HTTP_RESPONSES.NOT_FOUND).json({
        message: "Usuario no encontrado",
      });
    }

    let friendship = await Friendship.getRelationship(userId, targetUserId);

    if (friendship) {
      if (friendship.status === "blocked") {
        return res.status(HTTP_RESPONSES.OK).json({
          message: "Usuario ya está bloqueado",
        });
      }

      friendship.status = "blocked";
      friendship.requester = userId;
      friendship.recipient = targetUserId;
      await friendship.save();
    } else {
      friendship = new Friendship({
        requester: userId,
        recipient: targetUserId,
        status: "blocked",
      });
      await friendship.save();
    }

    return res.status(HTTP_RESPONSES.OK).json({
      message: "Usuario bloqueado exitosamente",
    });
  } catch (error) {
    console.error("Error al bloquear usuario:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const unblockUser = async (req, res) => {
  try {
    const { userId: targetUserId } = req.params;
    const userId = req.user.id;

    const friendship = await Friendship.getRelationship(userId, targetUserId);

    if (!friendship || friendship.status !== "blocked") {
      return res.status(HTTP_RESPONSES.NOT_FOUND).json({
        message: "Usuario no está bloqueado",
      });
    }

    if (friendship.requester.toString() !== userId) {
      return res.status(HTTP_RESPONSES.FORBIDDEN).json({
        message: "No puedes desbloquear a este usuario",
      });
    }

    await Friendship.findByIdAndDelete(friendship._id);

    return res.status(HTTP_RESPONSES.OK).json({
      message: "Usuario desbloqueado exitosamente",
    });
  } catch (error) {
    console.error("Error al desbloquear usuario:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const searchUsers = async (req, res) => {
  try {
    const { q, all } = req.query;
    const userId = req.user.id;

    let users;

    if (all === "true") {
      users = await User.find({}).select("username email image").limit(50);
      users = users.filter((u) => u._id.toString() !== userId);
    } else {
      if (!q || q.trim().length < 2) {
        return res.status(HTTP_RESPONSES.BAD_REQUEST).json({
          message: "La búsqueda debe tener al menos 2 caracteres",
        });
      }

      const searchTerm = q.trim();

      users = await User.find({
        $or: [
          { username: { $regex: searchTerm, $options: "i" } },
          { email: { $regex: searchTerm, $options: "i" } },
        ],
      })
        .select("username email image")
        .limit(20);
      users = users.filter((u) => u._id.toString() !== userId);
    }

    const usersWithStatus = await Promise.all(
      users.map(async (user) => {
        const relationship = await Friendship.getRelationship(userId, user._id);
        let relationshipStatus = "none";

        if (relationship) {
          if (relationship.status === "accepted") {
            relationshipStatus = "friends";
          } else if (relationship.status === "pending") {
            relationshipStatus =
              relationship.requester.toString() === userId
                ? "sent"
                : "received";
          } else if (relationship.status === "blocked") {
            relationshipStatus = "blocked";
          }
        }

        return {
          ...user.toObject(),
          relationshipStatus,
        };
      })
    );

    return res.status(HTTP_RESPONSES.OK).json({
      users: usersWithStatus,
      query: q || "todos",
    });
  } catch (error) {
    console.error("Error al buscar usuarios:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

const getBlockedUsers = async (req, res) => {
  try {
    const userId = req.user.id;

    const blockedRelations = await Friendship.find({
      requester: userId,
      status: "blocked",
    }).populate("recipient", "username email image");

    const blockedUsers = blockedRelations.map((relation) => ({
      _id: relation.recipient._id,
      username: relation.recipient.username,
      email: relation.recipient.email,
      image: relation.recipient.image,
      blockedAt: relation.updatedAt,
    }));

    return res.status(HTTP_RESPONSES.OK).json({
      blockedUsers,
      count: blockedUsers.length,
    });
  } catch (error) {
    console.error("Error al obtener usuarios bloqueados:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

module.exports = {
  sendFriendRequest,
  respondFriendRequest,
  getFriends,
  getPendingRequests,
  getSentRequests,
  removeFriendship,
  blockUser,
  unblockUser,
  getBlockedUsers,
  searchUsers,
};
