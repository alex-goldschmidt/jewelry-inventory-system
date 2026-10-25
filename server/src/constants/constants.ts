export const HttpStatusCode = {
  NOT_FOUND: 404,
  CREATED: 201,
  CONFLICT: 409,
  BAD_REQUEST: 400,
  SUCCESS: 200,
  NO_CONTENT: 204,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  SERVER_ERROR: 500,
} as const;

export type HttpStatusCode = (typeof HttpStatusCode)[keyof typeof HttpStatusCode];
