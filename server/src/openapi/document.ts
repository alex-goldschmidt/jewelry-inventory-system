import {
  OpenApiGeneratorV3,
  OpenAPIRegistry,
} from "@asteasolutions/zod-to-openapi";
import { z } from "./zod";
import { HttpStatusCode } from "../constants/constants";
import { AuthTokenResponseSchema } from "../models/auth.model";
import { ErrorResponseSchema, SuccessResponseSchema } from "../models/common.model";
import { UserSchema } from "../models/user.model";
import { UserInputSchema } from "../models/userCreateInput.model";
import { UserIdStringSchema } from "../utils/authClaims";

const jsonContent = <T extends z.ZodType>(schema: T) => ({
  "application/json": { schema },
});

const errorResponse = (description: string) => ({
  description,
  content: jsonContent(ErrorResponseSchema),
});

export function createOpenApiDocument() {
  const registry = new OpenAPIRegistry();

  registry.registerComponent("securitySchemes", "bearerAuth", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
  });

  registry.registerComponent("securitySchemes", "refreshTokenCookie", {
    type: "apiKey",
    in: "cookie",
    name: "refreshToken",
  });

  registry.registerPath({
    method: "post",
    path: "/api/users/register",
    operationId: "registerUser",
    tags: ["Users"],
    summary: "Register a user",
    request: {
      body: {
        required: true,
        description: "User registration payload",
        content: jsonContent(UserInputSchema),
      },
    },
    responses: {
      [HttpStatusCode.CREATED]: {
        description: "User was registered",
        content: jsonContent(SuccessResponseSchema),
      },
      [HttpStatusCode.BAD_REQUEST]: errorResponse("Invalid request body"),
      [HttpStatusCode.CONFLICT]: errorResponse("User already exists"),
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/users/signIn",
    operationId: "signIn",
    tags: ["Users"],
    summary: "Sign in a user",
    request: {
      body: {
        required: true,
        description: "User sign-in credentials",
        content: jsonContent(UserInputSchema),
      },
    },
    responses: {
      [HttpStatusCode.SUCCESS]: {
        description: "Access token response; refresh token is set as a cookie",
        content: jsonContent(AuthTokenResponseSchema),
      },
      [HttpStatusCode.BAD_REQUEST]: errorResponse("Invalid request body"),
      [HttpStatusCode.UNAUTHORIZED]: errorResponse("Invalid credentials"),
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/users/refreshToken",
    operationId: "refreshAccessToken",
    tags: ["Users"],
    summary: "Refresh the access token",
    security: [{ refreshTokenCookie: [] }],
    responses: {
      [HttpStatusCode.SUCCESS]: {
        description: "New access token response; refresh token is rotated",
        content: jsonContent(AuthTokenResponseSchema),
      },
      [HttpStatusCode.UNAUTHORIZED]: errorResponse("Missing or invalid token"),
      [HttpStatusCode.FORBIDDEN]: errorResponse("Refresh token was revoked"),
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/users/logout",
    operationId: "logout",
    tags: ["Users"],
    summary: "Log out a user",
    security: [{ refreshTokenCookie: [] }],
    responses: {
      [HttpStatusCode.SUCCESS]: {
        description: "User was logged out",
        content: jsonContent(SuccessResponseSchema),
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/users/me",
    operationId: "getCurrentUser",
    tags: ["Users"],
    summary: "Get the authenticated user",
    security: [{ bearerAuth: [] }],
    responses: {
      [HttpStatusCode.SUCCESS]: {
        description: "Public profile of the authenticated user",
        content: jsonContent(UserSchema),
      },
      [HttpStatusCode.UNAUTHORIZED]: errorResponse("Missing token"),
      [HttpStatusCode.FORBIDDEN]: errorResponse("Invalid or expired token"),
      [HttpStatusCode.NOT_FOUND]: errorResponse("User was not found"),
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/users/{userId}",
    operationId: "getUserById",
    tags: ["Users"],
    summary: "Get a user by id",
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({
        userId: UserIdStringSchema.openapi({
          example: "1",
          param: {
            name: "userId",
            in: "path",
            required: true,
            description: "Canonical positive safe-integer user identifier",
          },
        }),
      }),
    },
    responses: {
      [HttpStatusCode.SUCCESS]: {
        description: "Public user profile",
        content: jsonContent(UserSchema),
      },
      [HttpStatusCode.UNAUTHORIZED]: errorResponse("Missing or invalid token"),
      [HttpStatusCode.FORBIDDEN]: errorResponse("User is not authorized"),
      [HttpStatusCode.NOT_FOUND]: errorResponse("User was not found"),
    },
  });

  const generator = new OpenApiGeneratorV3(registry.definitions);

  return generator.generateDocument({
    openapi: "3.0.0",
    info: {
      title: "Personal Express TypeScript Setup API",
      version: "1.0.0",
    },
  });
}
