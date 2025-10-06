const Friendship = require("../models/friendship");
const User = require("../models/user");
const { HTTP_RESPONSES, HTTP_MESSAGES } = require("../models/httpResponses");

// Enviar solicitud de amistad
const sendFriendRequest = async (req, res) => {
  try {
    const { recipientId, message } = req.body;
    const requesterId = req.user.id;

    // Validar que no se envíe solicitud a sí mismo
    if (requesterId === recipientId) {
      return res.status(HTTP_RESPONSES.BAD_REQUEST).json({
        message: "No puedes enviarte una solicitud de amistad a ti mismo"
      });
    }

    // Verificar que el destinatario existe
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(HTTP_RESPONSES.NOT_FOUND).json({
        message: "Usuario no encontrado"
      });
    }

    // Verificar si ya existe una relación
    const existingRelation = await Friendship.getRelationship(requesterId, recipientId);
    if (existingRelation) {
      let message = "Ya existe una relación con este usuario";
      if (existingRelation.status === 'pending') {
        message = "Ya hay una solicitud de amistad pendiente";
      } else if (existingRelation.status === 'accepted') {
        message = "Ya son amigos";
      } else if (existingRelation.status === 'blocked') {
        message = "No se puede enviar solicitud a este usuario";
      }
      return res.status(HTTP_RESPONSES.BAD_REQUEST).json({ message });
    }

    // Crear nueva solicitud de amistad
    const friendship = new Friendship({
      requester: requesterId,
      recipient: recipientId,
      message: message || "",
      status: 'pending'
    });

    await friendship.save();
    await friendship.populate('recipient', 'username email image');

    return res.status(HTTP_RESPONSES.CREATED).json({
      message: "Solicitud de amistad enviada",
      friendship
    });

  } catch (error) {
    console.error("Error al enviar solicitud de amistad:", error);
    return res.status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR).json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

// Responder a solicitud de amistad (aceptar/rechazar)
const respondFriendRequest = async (req, res) => {
  try {
    const { friendshipId } = req.params;
    const { action } = req.body; // 'accept' or 'decline'
    const userId = req.user.id;

    const friendship = await Friendship.findById(friendshipId);
    if (!friendship) {
      return res.status(HTTP_RESPONSES.NOT_FOUND).json({
        message: "Solicitud de amistad no encontrada"
      });
    }

    // Verificar que el usuario es el destinatario de la solicitud
    if (friendship.recipient.toString() !== userId) {
      return res.status(HTTP_RESPONSES.FORBIDDEN).json({
        message: "No tienes permisos para responder a esta solicitud"
      });
    }

    // Verificar que la solicitud está pendiente
    if (friendship.status !== 'pending') {
      return res.status(HTTP_RESPONSES.BAD_REQUEST).json({
        message: "Esta solicitud ya fue procesada"
      });
    }

    // Actualizar estado según la acción
    if (action === 'accept') {
      friendship.status = 'accepted';
    } else if (action === 'decline') {
      friendship.status = 'declined';
    } else {
      return res.status(HTTP_RESPONSES.BAD_REQUEST).json({
        message: "Acción no válida. Usar 'accept' o 'decline'"
      });
    }

    await friendship.save();
    await friendship.populate('requester', 'username email image');

    const message = action === 'accept' ? 
      "Solicitud de amistad aceptada" : 
      "Solicitud de amistad rechazada";

    return res.status(HTTP_RESPONSES.OK).json({
      message,
      friendship
    });

  } catch (error) {
    console.error("Error al responder solicitud:", error);
    return res.status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR).json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

// Obtener lista de amigos
const getFriends = async (req, res) => {
  try {
    const userId = req.user.id;
    const friends = await Friendship.getFriends(userId);

    // Formatear la respuesta para incluir solo la información del amigo
    const friendsList = friends.map(friendship => {
      const friend = friendship.requester._id.toString() === userId ? 
        friendship.recipient : friendship.requester;
      
      return {
        friendshipId: friendship._id,
        user: friend,
        friendsSince: friendship.updatedAt
      };
    });

    return res.status(HTTP_RESPONSES.OK).json({
      friends: friendsList,
      count: friendsList.length
    });

  } catch (error) {
    console.error("Error al obtener amigos:", error);
    return res.status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR).json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

// Obtener solicitudes pendientes recibidas
const getPendingRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    const requests = await Friendship.getPendingRequests(userId);

    const formattedRequests = requests.map(request => ({
      friendshipId: request._id,
      requester: request.requester,
      message: request.message,
      createdAt: request.createdAt
    }));

    return res.status(HTTP_RESPONSES.OK).json({
      requests: formattedRequests,
      count: formattedRequests.length
    });

  } catch (error) {
    console.error("Error al obtener solicitudes:", error);
    return res.status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR).json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

// Obtener solicitudes enviadas
const getSentRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    const requests = await Friendship.getSentRequests(userId);

    const formattedRequests = requests.map(request => ({
      friendshipId: request._id,
      recipient: request.recipient,
      message: request.message,
      createdAt: request.createdAt
    }));

    return res.status(HTTP_RESPONSES.OK).json({
      requests: formattedRequests,
      count: formattedRequests.length
    });

  } catch (error) {
    console.error("Error al obtener solicitudes enviadas:", error);
    return res.status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR).json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

// Eliminar amistad o cancelar solicitud
const removeFriendship = async (req, res) => {
  try {
    const { friendshipId } = req.params;
    const userId = req.user.id;

    const friendship = await Friendship.findById(friendshipId);
    if (!friendship) {
      return res.status(HTTP_RESPONSES.NOT_FOUND).json({
        message: "Relación no encontrada"
      });
    }

    // Verificar que el usuario tiene permisos (es requester o recipient)
    const isRequester = friendship.requester.toString() === userId;
    const isRecipient = friendship.recipient.toString() === userId;

    if (!isRequester && !isRecipient) {
      return res.status(HTTP_RESPONSES.FORBIDDEN).json({
        message: "No tienes permisos para eliminar esta relación"
      });
    }

    await Friendship.findByIdAndDelete(friendshipId);

    let message = "Relación eliminada";
    if (friendship.status === 'pending') {
      message = isRequester ? "Solicitud cancelada" : "Solicitud eliminada";
    } else if (friendship.status === 'accepted') {
      message = "Amistad eliminada";
    }

    return res.status(HTTP_RESPONSES.OK).json({ message });

  } catch (error) {
    console.error("Error al eliminar relación:", error);
    return res.status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR).json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

// Bloquear usuario
const blockUser = async (req, res) => {
  try {
    const { userId: targetUserId } = req.params;
    const userId = req.user.id;

    // Validar que no se bloquee a sí mismo
    if (userId === targetUserId) {
      return res.status(HTTP_RESPONSES.BAD_REQUEST).json({
        message: "No puedes bloquearte a ti mismo"
      });
    }

    // Verificar que el usuario objetivo existe
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(HTTP_RESPONSES.NOT_FOUND).json({
        message: "Usuario no encontrado"
      });
    }

    // Buscar relación existente
    let friendship = await Friendship.getRelationship(userId, targetUserId);
    
    if (friendship) {
      // Si ya está bloqueado, no hacer nada
      if (friendship.status === 'blocked') {
        return res.status(HTTP_RESPONSES.OK).json({
          message: "Usuario ya está bloqueado"
        });
      }
      
      // Actualizar relación existente a bloqueada
      friendship.status = 'blocked';
      friendship.requester = userId; // El que bloquea se convierte en requester
      friendship.recipient = targetUserId;
      await friendship.save();
    } else {
      // Crear nueva relación de bloqueo
      friendship = new Friendship({
        requester: userId,
        recipient: targetUserId,
        status: 'blocked'
      });
      await friendship.save();
    }

    return res.status(HTTP_RESPONSES.OK).json({
      message: "Usuario bloqueado exitosamente"
    });

  } catch (error) {
    console.error("Error al bloquear usuario:", error);
    return res.status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR).json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

// Desbloquear usuario
const unblockUser = async (req, res) => {
  try {
    const { userId: targetUserId } = req.params;
    const userId = req.user.id;

    const friendship = await Friendship.getRelationship(userId, targetUserId);
    
    if (!friendship || friendship.status !== 'blocked') {
      return res.status(HTTP_RESPONSES.NOT_FOUND).json({
        message: "Usuario no está bloqueado"
      });
    }

    // Verificar que el usuario actual es quien bloqueó
    if (friendship.requester.toString() !== userId) {
      return res.status(HTTP_RESPONSES.FORBIDDEN).json({
        message: "No puedes desbloquear a este usuario"
      });
    }

    await Friendship.findByIdAndDelete(friendship._id);

    return res.status(HTTP_RESPONSES.OK).json({
      message: "Usuario desbloqueado exitosamente"
    });

  } catch (error) {
    console.error("Error al desbloquear usuario:", error);
    return res.status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR).json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
  }
};

// Buscar usuarios para enviar solicitud
const searchUsers = async (req, res) => {
  try {
    const { q } = req.query; // query string
    const userId = req.user.id;

    if (!q || q.trim().length < 2) {
      return res.status(HTTP_RESPONSES.BAD_REQUEST).json({
        message: "La búsqueda debe tener al menos 2 caracteres"
      });
    }

    const searchTerm = q.trim();
    
    // Buscar usuarios por username o email
    const users = await User.find({
      $and: [
        { _id: { $ne: userId } }, // Excluir al usuario actual
        {
          $or: [
            { username: { $regex: searchTerm, $options: 'i' } },
            { email: { $regex: searchTerm, $options: 'i' } }
          ]
        }
      ]
    }).select('username email image').limit(20);

    // Para cada usuario, obtener el estado de la relación
    const usersWithStatus = await Promise.all(
      users.map(async (user) => {
        const relationship = await Friendship.getRelationship(userId, user._id);
        let relationshipStatus = 'none';
        
        if (relationship) {
          if (relationship.status === 'accepted') {
            relationshipStatus = 'friends';
          } else if (relationship.status === 'pending') {
            relationshipStatus = relationship.requester.toString() === userId ? 'sent' : 'received';
          } else if (relationship.status === 'blocked') {
            relationshipStatus = 'blocked';
          }
        }

        return {
          ...user.toObject(),
          relationshipStatus
        };
      })
    );

    return res.status(HTTP_RESPONSES.OK).json({
      users: usersWithStatus,
      query: searchTerm
    });

  } catch (error) {
    console.error("Error al buscar usuarios:", error);
    return res.status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR).json(HTTP_MESSAGES.INTERNAL_SERVER_ERROR);
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
  searchUsers
};