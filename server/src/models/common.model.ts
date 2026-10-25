import { z } from "../openapi/zod";

export const SuccessResponseSchema = z
  .object({
    success: z.boolean().openapi({ example: true }),
  })
  .strict()
  .openapi("SuccessResponse");

export type SuccessResponse = z.infer<typeof SuccessResponseSchema>;

export const ErrorItemSchema = z
  .object({
    field: z.string().openapi({ example: "email" }),
    message: z.string().openapi({ example: "Enter a valid email address" }),
  })
  .strict()
  .openapi("ErrorItem");

export const ErrorResponseSchema = z
  .object({
    statusCode: z.number().int().openapi({ example: 400 }),
    message: z.string().openapi({ example: "Validation failed" }),
    errors: z.array(ErrorItemSchema).optional(),
  })
  .strict()
  .openapi("ErrorResponse");

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
