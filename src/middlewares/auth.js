const User = require("../api/models/user");
const { verificarLlave } = require("../utils/jwt");
const { HTTP_RESPONSES } = require("../api/models/httpResponses");

const isAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization;
    if (!token) {
      return res
        .status(HTTP_RESPONSES.UNAUTHORIZED)
        .json({ message: "Token no proporcionado, acceso no autorizado" });
    }
    const parsedToken = token.replace("Bearer ", "");
    const { id } = verificarLlave(parsedToken);
    const user = await User.findById(id);
    if (!user) {
      return res
        .status(HTTP_RESPONSES.NOT_FOUND)
        .json({ message: "Usuario no encontrado" });
    }
    user.password = null;
    req.user = user;
    next();
  } catch (error) {
    console.error(error);
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res
        .status(HTTP_RESPONSES.UNAUTHORIZED)
        .json({ message: "Token inválido o expirado" });
    }
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR.code)
      .json({ message: HTTP_RESPONSES.INTERNAL_SERVER_ERROR.message });
  }
};

const isAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization;
    if (!token) {
      return res
        .status(HTTP_RESPONSES.UNAUTHORIZED)
        .json({ message: "Token no proporcionado, acceso no autorizado" });
    }
    const parsedToken = token.replace("Bearer ", "");
    const { id } = verificarLlave(parsedToken);
    const user = await User.findById(id);
    if (!user) {
      return res
        .status(HTTP_RESPONSES.NOT_FOUND)
        .json({ message: "Usuario no encontrado" });
    }
    if (user.role !== "admin") {
      return res
        .status(HTTP_RESPONSES.FORBIDDEN || 403)
        .json({ message: "Acceso denegado: se requiere rol de administrador" });
    }
    user.password = null;
    req.user = user;
    next();
  } catch (error) {
    console.error(error);
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res
        .status(HTTP_RESPONSES.UNAUTHORIZED)
        .json({ message: "Token inválido o expirado" });
    }
    return res
      .status(HTTP_RESPONSES.INTERNAL_SERVER_ERROR.code)
      .json({ message: HTTP_RESPONSES.INTERNAL_SERVER_ERROR.message });
  }
};

module.exports = { isAuth, isAdmin };
