const { generarLlave } = require("../../utils/jwt");
const { HTTP_RESPONSES, HTTP_MESSAGES } = require("../models/httpResponses");
const User = require("../models/user");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");

const getUsers = async (req, res, next) => {
  try {
    const users = await User.find();
    if (!users) {
      return res.status(HTTP_RESPONSES.NOT_FOUND).json({ message: "No hay usuarios" });
    }
    return res.status(HTTP_RESPONSES.OK).json(users);
  } catch (error) {
    console.log(error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json({ message: HTTP_MESSAGES.INTERNAL_SERVER_ERROR });
  }
};

const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(HTTP_RESPONSES.BAD_REQUEST).json({ message: "Id faltante" });
    }
    const user = await User.findById(id);
    if (!user) {
      return res.status(HTTP_RESPONSES.NOT_FOUND).json({ message: "Usuario no encontrado" });
    }
    return res.status(HTTP_RESPONSES.OK).json(user);
  } catch (error) {
    console.log(error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json({ message: HTTP_MESSAGES.INTERNAL_SERVER_ERROR });
  }
};

const register = async (req, res, next) => {
  try {
    console.log("Register user: ", req.body.username);
    if (!req.body.username || !req.body.email || !req.body.password) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json("Nombre de usuario, email y/o contraseña faltantes");
    }
    const nameDuplicated = await User.findOne({ username: req.body.username });
    const emailDuplicated = await User.findOne({ email: req.body.email });
    if (nameDuplicated) {
      return res.status(HTTP_RESPONSES.CONFLICT).json({ message: "Usuario ya existente" });
    }
    if (emailDuplicated) {
      return res.status(HTTP_RESPONSES.CONFLICT).json({ message: "Email ya registrado" });
    }
    const image =
      "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_640.png";
    const newUser = new User({
      username: req.body.username,
      email: req.body.email,
      password: req.body.password,
      image: image,
      role: "user",
    });
    const user = await newUser.save();
    return res.status(HTTP_RESPONSES.CREATED).json(user);
  } catch (error) {
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json({ message: HTTP_MESSAGES.INTERNAL_SERVER_ERROR });
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json("Email y/o contraseña faltantes");
    }
    const user = await User.findOne({ email });
    if (user) {
      const match = await bcrypt.compare(password.trim(), user.password.trim());
      if (match) {
        console.log("login autorizado");
        const token = generarLlave(user._id);
        const userData = {
          id: user._id,
          email: user.email,
          role: user.role,
        };
        return res.status(HTTP_RESPONSES.OK).json({ token, user: userData });
      } else {
        return res
          .status(HTTP_RESPONSES.UNAUTHORIZED)
          .json("Usuario y/o contraseña incorrectos");
      }
    } else {
      return res.status(HTTP_RESPONSES.NOT_FOUND).json({ message: "Usuario no existe" });
    }
  } catch (error) {
    console.log(error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json({ message: HTTP_MESSAGES.INTERNAL_SERVER_ERROR });
  }
};

const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { username } = req.body;
    console.log("Update user: ", id);
    if (!id) {
      return res.status(HTTP_RESPONSES.BAD_REQUEST).json({ message: "Id faltante" });
    }
    if (req.user._id.toString() !== id) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Id de usuario incorrecto" });
    }
    if (!username) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json({ message: "Nuevo username requerido" });
    }
    const oldUser = await User.findById(id);
    if (!oldUser) {
      return res.status(HTTP_RESPONSES.NOT_FOUND).json({ message: "Usuario no encontrado" });
    }
    const existingUser = await User.findOne({ username });
    if (existingUser && existingUser._id.toString() !== id) {
      return res
        .status(HTTP_RESPONSES.BAD_REQUEST)
        .json("Username ya está en uso");
    }

    const userUpdated = await User.findByIdAndUpdate(
      id,
      { username },
      { new: true }
    );
    if (!userUpdated) {
      return res.status(HTTP_RESPONSES.NOT_FOUND).json({ message: "Usuario no encontrado" });
    }
    return res.status(HTTP_RESPONSES.OK).json(userUpdated);
  } catch (error) {
    console.log(error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json({ message: HTTP_MESSAGES.INTERNAL_SERVER_ERROR });
  }
};

const updateImage = async (req, res, next) => {
  const { id } = req.params;
  const img = req.file.path;
  try {
    console.log("Image Path:", req.file.path);
    const userUpdated = await User.findByIdAndUpdate(
      id,
      { image: img },
      { new: true }
    );
    if (!userUpdated) {
      return res.status(HTTP_RESPONSES.NOT_FOUND).json({ message: "Usuario no encontrado" });
    }
    return res.status(HTTP_RESPONSES.OK).json({ imageUrl: img });
  } catch (error) {
    console.log(error);
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR)
      .json({ message: HTTP_MESSAGES.INTERNAL_SERVER_ERROR });
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
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




