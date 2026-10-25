import z from "zod";
import { ErrorItem, ValidationError } from "../config/exceptions";

export function validateWithZod<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);

  if (result.success) {
    return result.data;
  }

  const errors: ErrorItem[] = result.error.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));

  throw new ValidationError(errors);
}
