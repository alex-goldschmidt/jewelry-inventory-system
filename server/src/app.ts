import express from "express";
import cors from "cors";
import path from "path";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import { Request, Response } from "express";
import process from "process";
import dotenv from "dotenv";
import apiRouter from "./routes";
import { errorHandler } from "./middlewares/error.middleware";
import { HttpStatusCode } from "./constants/constants";
import { createOpenApiDocument } from "./openapi/document";
import type {} from "./types/express";
import swaggerUi from "swagger-ui-express";

const app = express();
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.use(cors());
dotenv.config();

app.get("/api/openapi.json", (_req: Request, res: Response) => {
  res.json(createOpenApiDocument());
});

app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(createOpenApiDocument()));

app.use("/api", apiRouter);

app.use((req: Request, res: Response) => {
  res.status(HttpStatusCode.NOT_FOUND).json({
    statusCode: HttpStatusCode.NOT_FOUND,
    message: `${req.method} ${req.originalUrl} Not Found`,
  });
});

app.use(errorHandler);

const port = process.env.PORT;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

export default app;
