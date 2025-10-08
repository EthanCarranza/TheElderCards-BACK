const { generarLlave } = require("../../utils/jwt");
const { HTTP_RESPONSES, HTTP_MESSAGES } = require("../models/httpResponses");
const User = require("../models/user");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");

const DEFAULT_PROFILE_IMAGE =
  User.DEFAULT_PROFILE_IMAGE ||
  "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_640.png";

const sanitizeUser = (user) => {
  if (!user) return null;
  const base =
    typeof user.toObject === "function"
      ? user.toObject({ versionKey: false })
      : { ...user };
  delete base.password;
  if (base._id && !base.id) {
    base.id = base._id.toString();
  }
  base.image = base.image || DEFAULT_PROFILE_IMAGE;
  return base;
};

const hasAccessToUser = (requestingUser, targetUserId) => {
  if (!requestingUser) return false;
  if (requestingUser.role === "admin") return true;
  return requestingUser._id.toString() === targetUserId;
};

const getUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password").lean();
    if (!users || users.length === 0) {
      return res
        .status(HTTP_RESPONSES.NOT_FOUND)
        .json({ message: "No hay usuarios" });
    }
    const sanitized = users.map((user) => sanitizeUser(user));
    return res.status(HTTP_RESPONSES.OK).json(sanitized);
  } catch (error) {
    console.log(error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json({ message: HTTP_MESSAGES.INTERNAL_SERVER_ERROR });
  }
};

const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Id faltante" });
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Id de usuario invalido" });
    }

    if (req.user && !hasAccessToUser(req.user, id)) {
      return res
        .status(HTTP_RESPONSES.FORBIDDEN)
        .json({ message: "No tienes permisos para ver este perfil" });
    }

    const user = await User.findById(id).select("-password");
    if (!user) {
      return res
        .status(HTTP_RESPONSES.NOT_FOUND)
        .json({ message: "Usuario no encontrado" });
    }
    return res.status(HTTP_RESPONSES.OK).json(sanitizeUser(user));
  } catch (error) {
    console.log(error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json({ message: HTTP_MESSAGES.INTERNAL_SERVER_ERROR });
  }
};

const register = async (req, res) => {
  try {
    const { username, email, password } = req.body || {};
    if (!username || !email || !password) {
      return res.status(HTTP_RESPONSES.BAD_REQUEST).json({
        message: "Nombre de usuario, email y/o contrasena faltantes",
      });
    }

    const trimmedUsername = username.trim();
    const normalizedEmail = email.trim().toLowerCase();

    const nameDuplicated = await User.findOne({ username: trimmedUsername });
    const emailDuplicated = await User.findOne({ email: normalizedEmail });
    if (nameDuplicated) {
      return res
        .status(HTTP_RESPONSES.CONFLICT)
        .json({ message: "Usuario ya existente" });
    }
    if (emailDuplicated) {
      return res
        .status(HTTP_RESPONSES.CONFLICT)
        .json({ message: "Email ya registrado" });
    }

    const newUser = new User({
      username: trimmedUsername,
      email: normalizedEmail,
      password,
      image: DEFAULT_PROFILE_IMAGE,
      role: "user",
    });
    const user = await newUser.save();
    return res.status(HTTP_RESPONSES.CREATED).json(sanitizeUser(user));
  } catch (error) {
    console.log(error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json({ message: HTTP_MESSAGES.INTERNAL_SERVER_ERROR });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Email/usuario y/o contrasena faltantes" });
    }
    const normalizedInput = email.trim();
    console.log("Buscando usuario con:", normalizedInput);

    const user = await User.findOne({
      $or: [
        { email: normalizedInput.toLowerCase() },
        { username: { $regex: new RegExp(`^${normalizedInput}$`, "i") } },
      ],
    });

    console.log("Usuario encontrado:", user ? user.username : "no encontrado");
    if (user) {
      const match = await bcrypt.compare(password.trim(), user.password.trim());
      if (match) {
        const token = generarLlave(user._id);
        const userData = {
          id: user._id,
          email: user.email,
          role: user.role,
          username: user.username,
          image: user.image || DEFAULT_PROFILE_IMAGE,
        };
        return res.status(HTTP_RESPONSES.OK).json({ token, user: userData });
      } else {
        return res
          .status(HTTP_RESPONSES.UNAUTHORIZED)
          .json({ message: "Credenciales incorrectas" });
      }
    } else {
      return res
        .status(HTTP_RESPONSES.UNAUTHORIZED)
        .json({ message: "Credenciales incorrectas" });
    }
  } catch (error) {
    console.log(error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json({ message: HTTP_MESSAGES.INTERNAL_SERVER_ERROR });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, password } = req.body || {};
    if (!id) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Id faltante" });
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Id de usuario invalido" });
    }
    if (!req.user || !hasAccessToUser(req.user, id)) {
      return res
        .status(HTTP_RESPONSES.FORBIDDEN)
        .json({ message: "No tienes permisos para actualizar este perfil" });
    }

    const existingUser = await User.findById(id);
    if (!existingUser) {
      return res
        .status(HTTP_RESPONSES.NOT_FOUND)
        .json({ message: "Usuario no encontrado" });
    }

    const updates = {};
    if (
      typeof username === "string" &&
      username.trim() &&
      username.trim() !== existingUser.username
    ) {
      const usernameInUse = await User.findOne({ username: username.trim() });
      if (usernameInUse && usernameInUse._id.toString() !== id) {
        return res
          .status(HTTP_RESPONSES.CONFLICT)
          .json({ message: "Username ya esta en uso" });
      }
      updates.username = username.trim();
    }

    if (typeof email === "string" && email.trim()) {
      const normalizedEmail = email.trim().toLowerCase();
      if (normalizedEmail !== existingUser.email) {
        const emailInUse = await User.findOne({ email: normalizedEmail });
        if (emailInUse && emailInUse._id.toString() !== id) {
          return res
            .status(HTTP_RESPONSES.CONFLICT)
            .json({ message: "Email ya registrado" });
        }
        updates.email = normalizedEmail;
      }
    }

    if (typeof password === "string" && password.trim()) {
      updates.password = await bcrypt.hash(password.trim(), 10);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(HTTP_RESPONSES.OK).json(sanitizeUser(existingUser));
    }

    const userUpdated = await User.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!userUpdated) {
      return res
        .status(HTTP_RESPONSES.NOT_FOUND)
        .json({ message: "Usuario no encontrado" });
    }

    return res.status(HTTP_RESPONSES.OK).json(sanitizeUser(userUpdated));
  } catch (error) {
    console.log(error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json({ message: HTTP_MESSAGES.INTERNAL_SERVER_ERROR });
  }
};

const updateImage = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Id faltante" });
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Id de usuario invalido" });
    }
    if (!req.user || !hasAccessToUser(req.user, id)) {
      return res
        .status(HTTP_RESPONSES.FORBIDDEN)
        .json({ message: "No tienes permisos para actualizar este perfil" });
    }

    if (!req.file || !req.file.path) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Imagen no proporcionada" });
    }

    const img = req.file.path;
    const userUpdated = await User.findByIdAndUpdate(
      id,
      { image: img },
      { new: true }
    );
    if (!userUpdated) {
      return res
        .status(HTTP_RESPONSES.NOT_FOUND)
        .json({ message: "Usuario no encontrado" });
    }
    return res.status(HTTP_RESPONSES.OK).json({
      imageUrl: userUpdated.image || DEFAULT_PROFILE_IMAGE,
      user: sanitizeUser(userUpdated),
    });
  } catch (error) {
    console.log(error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json({ message: HTTP_MESSAGES.INTERNAL_SERVER_ERROR });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Id faltante" });
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Id de usuario invalido" });
    }
    if (!req.user || !hasAccessToUser(req.user, id)) {
      return res
        .status(HTTP_RESPONSES.FORBIDDEN)
        .json({ message: "No tienes permisos para eliminar este perfil" });
    }

    const user = await User.findById(id);
    if (!user) {
      return res
        .status(HTTP_RESPONSES.NOT_FOUND)
        .json({ message: "Usuario no encontrado" });
    }

    await User.findByIdAndDelete(id);
    return res
      .status(HTTP_RESPONSES.OK)
      .json({ message: "Perfil eliminado correctamente." });
  } catch (error) {
    console.error("Error al eliminar el perfil:", error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json({ message: "Error interno del servidor." });
  }
};

module.exports = {
  getUsers,
  getUserById,
  register,
  login,
  updateUser,
  updateImage,
  deleteUser,
};
