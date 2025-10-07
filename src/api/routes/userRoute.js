const { isAuth } = require("../../middlewares/auth");
const {
  getUsers,
  getUserById,
  register,
  login,
  updateUser,
  updateImage,
  deleteUser,
} = require("../controllers/userController");

const usersRouter = require("express").Router();
const { uploadProfile } = require("../../middlewares/fileStorage");

usersRouter.get("/", getUsers);
usersRouter.get("/:id", isAuth, getUserById);
usersRouter.post("/register", register);
usersRouter.post("/login", login);
usersRouter.put("/:id", isAuth, updateUser);
usersRouter.put(
  "/profileImage/:id",
  isAuth,
  uploadProfile.single("img"),
  updateImage
);
usersRouter.delete("/:id", isAuth, deleteUser);

module.exports = usersRouter;
