const express = require("express");
const router = express.Router();
const {
  sendFriendRequest,
  respondFriendRequest,
  getFriends,
  getPendingRequests,
  getSentRequests,
  removeFriendship,
  blockUser,
  unblockUser,
  searchUsers,
  cleanupOrphanedFriendships
} = require("../controllers/friendshipController");
const { isAuth } = require("../../middlewares/auth");

// Buscar usuarios para enviar solicitudes
router.get("/users/search", isAuth, searchUsers);

// Enviar solicitud de amistad
router.post("/", isAuth, sendFriendRequest);

// Obtener lista de amigos
router.get("/", isAuth, getFriends);

// Obtener solicitudes pendientes recibidas
router.get("/pending", isAuth, getPendingRequests);

// Obtener solicitudes enviadas
router.get("/sent", isAuth, getSentRequests);

// Responder a solicitud de amistad (aceptar/rechazar)
router.patch("/:friendshipId/respond", isAuth, respondFriendRequest);

// Eliminar amistad o cancelar solicitud
router.delete("/:friendshipId", isAuth, removeFriendship);

// Bloquear usuario
router.post("/block/:userId", isAuth, blockUser);

// Desbloquear usuario
router.delete("/block/:userId", isAuth, unblockUser);

router.post("/cleanup", isAuth, cleanupOrphanedFriendships);

module.exports = router;