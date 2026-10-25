import { HttpStatusCode } from "../constants/constants";

export interface ErrorItem {
  field: string;
  message: string;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errors: ErrorItem[];

  constructor(statusCode: number, message: string, errors: ErrorItem[] = []) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

export class ValidationError extends AppError {
  constructor(errors: ErrorItem[]) {
    super(HttpStatusCode.BAD_REQUEST, "Validation failed", errors);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "Not found") {
    super(HttpStatusCode.NOT_FOUND, message);
    this.name = "NotFoundError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized") {
    super(HttpStatusCode.UNAUTHORIZED, message);
    this.name = "UnauthorizedError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(HttpStatusCode.CONFLICT, message);
    this.name = "ConflictError";
  }
}
export class ForbiddenError extends AppError {
  constructor(message: string) {
    super(HttpStatusCode.FORBIDDEN, message);
    this.name = "ForbiddenError";
  }
}
