import { z } from "../openapi/zod";

export const UserSchema = z
  .object({
    userId: z.number().int().positive().openapi({ example: 1 }),
    email: z.email().openapi({ example: "user@example.com" }),
  })
  .strict()
  .openapi("User");

export type User = z.infer<typeof UserSchema>;
