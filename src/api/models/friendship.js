const mongoose = require("mongoose");

const friendshipSchema = new mongoose.Schema({
  // Usuario que envía la solicitud de amistad
  requester: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: true,
  },
  // Usuario que recibe la solicitud de amistad
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: true,
  },
  // Estado de la relación de amistad
  status: {
    type: String,
    enum: ["pending", "accepted", "blocked", "declined"],
    default: "pending",
    required: true,
  },
  // Fecha de creación de la solicitud
  createdAt: {
    type: Date,
    default: Date.now,
  },
  // Fecha de la última actualización (aceptar, rechazar, etc.)
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  // Mensaje opcional al enviar la solicitud
  message: {
    type: String,
    maxlength: 200,
    trim: true,
  },
});

// Índice compuesto para evitar solicitudes duplicadas
friendshipSchema.index({ requester: 1, recipient: 1 }, { unique: true });

// Middleware para actualizar el timestamp automáticamente
friendshipSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Método estático para encontrar amigos de un usuario
friendshipSchema.statics.getFriends = function(userId) {
  return this.find({
    $or: [
      { requester: userId, status: 'accepted' },
      { recipient: userId, status: 'accepted' }
    ]
  }).populate('requester', 'username email image')
    .populate('recipient', 'username email image');
};

// Método estático para encontrar solicitudes pendientes recibidas
friendshipSchema.statics.getPendingRequests = function(userId) {
  return this.find({
    recipient: userId,
    status: 'pending'
  }).populate('requester', 'username email image')
    .sort({ createdAt: -1 });
};

// Método estático para encontrar solicitudes pendientes enviadas
friendshipSchema.statics.getSentRequests = function(userId) {
  return this.find({
    requester: userId,
    status: 'pending'
  }).populate('recipient', 'username email image')
    .sort({ createdAt: -1 });
};

// Método estático para verificar si dos usuarios ya tienen una relación
friendshipSchema.statics.getRelationship = function(userId1, userId2) {
  return this.findOne({
    $or: [
      { requester: userId1, recipient: userId2 },
      { requester: userId2, recipient: userId1 }
    ]
  });
};

// Método estático para verificar si dos usuarios son amigos
friendshipSchema.statics.areFriends = async function(userId1, userId2) {
  const relationship = await this.getRelationship(userId1, userId2);
  return relationship && relationship.status === 'accepted';
};

// Método para obtener el estado de la relación desde la perspectiva de un usuario
friendshipSchema.methods.getStatusForUser = function(userId) {
  if (this.requester.toString() === userId.toString()) {
    // El usuario es quien envió la solicitud
    return {
      status: this.status,
      role: 'requester',
      otherUser: this.recipient
    };
  } else {
    // El usuario es quien recibió la solicitud
    return {
      status: this.status,
      role: 'recipient',
      otherUser: this.requester
    };
  }
};

const Friendship = mongoose.model("Friendship", friendshipSchema);

module.exports = Friendship;