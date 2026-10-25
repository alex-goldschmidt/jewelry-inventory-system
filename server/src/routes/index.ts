import { Router } from "express";
import authRouter from "./auth.route";

let apiRouter: Router = Router();

apiRouter.use("/users", authRouter);

export default apiRouter;
