import { Request, Response, NextFunction } from "express";
import { AppError, ErrorItem } from "../config/exceptions";
import { HttpStatusCode } from "../constants/constants";

interface ErrorResponse {
  message: string;
  errors?: ErrorItem[];
  statusCode: number;
  stack?: string;
}

export function errorHandler(
  err: Error | AppError | unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    if (err.statusCode >= HttpStatusCode.SERVER_ERROR) {
      console.error("Operational server error:", {
        message: err.message,
        statusCode: err.statusCode,
        path: req.originalUrl,
        method: req.method,
      });
    } else {
      console.warn("Client error:", err.message);
    }
  } else {
    console.error("Unhandled error:", err);
  }

  let response: ErrorResponse = {
    statusCode: HttpStatusCode.SERVER_ERROR,
    message: "Internal server error",
  };

  if (err instanceof AppError) {
    response = {
      statusCode: err.statusCode,
      message: err.message,
    };
    if (err.errors?.length) {
      response.errors = err.errors;
    }
  }

  if (req.app.get("env") === "development") {
    response.stack =
      err instanceof Error || err instanceof AppError ? err.stack : undefined;
  }

  res.status(response.statusCode).json(response);
}
