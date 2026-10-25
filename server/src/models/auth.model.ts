import { z } from "../openapi/zod";

export const AuthTokenResponseSchema = z
  .object({
    accessToken: z.string().min(1).openapi({
      example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    }),
  })
  .strict()
  .openapi("AuthTokenResponse");

export type AuthTokenResponse = z.infer<typeof AuthTokenResponseSchema>;
