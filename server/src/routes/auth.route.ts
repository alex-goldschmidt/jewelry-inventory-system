import { Router } from "express";
import {
  getUserById,
  getCurrentUser,
  logout,
  refreshToken,
  signIn,
  signUp,
} from "../controllers/auth.controller";
import { authenticateToken } from "../middlewares/authenticateToken.middleware";
import { authorizeUserId } from "../middlewares/authorization.middleware";
let authRouter: Router = Router();

authRouter.post("/register", signUp);
authRouter.get("/me", authenticateToken, getCurrentUser);
authRouter.get("/:userId", authenticateToken, authorizeUserId, getUserById);
authRouter.post("/signIn", signIn);
authRouter.post("/refreshToken", refreshToken);
authRouter.post("/logout", logout);

export default authRouter;
