// src/lib/schemas/contact.ts
import { z } from "zod";

// Matches your CreateContactDto (or relevant fields for the form)
export const createContactSchema = z.object({
  // Basic Contact Fields
  NAME: z.string().min(1, "First Name is required."),
  LAST_NAME: z.string().optional(),
  SECOND_NAME: z.string().optional(),
  COMMENTS: z.string().optional(), // If you want to include comments

  // Multi-field types (handled as single strings in the form, backend converts to array)
  PHONE: z.string().optional().or(z.literal("")), // Allow empty string
  EMAIL: z.string().email("Invalid email format.").optional().or(z.literal("")), // Allow empty string
  WEB: z.string().url("Invalid URL format.").optional().or(z.literal("")), // Allow empty string

  // Address Fields
  ADDRESS_1: z.string().optional(),
  ADDRESS_CITY: z.string().optional(),
  ADDRESS_REGION: z.string().optional(),
  ADDRESS_PROVINCE: z.string().optional(),

  // Requisite Fields (nested object)
  requisite: z
    .object({
      NAME: z.string().optional(), // Requisite Name
      RQ_BANK_NAME: z.string().optional(),
      RQ_ACC_NUM: z.string().optional(),
    })
    .optional(), // The entire requisite object is optional
});

// Infer the TypeScript type from the schema
export type CreateContactFormValues = z.infer<typeof createContactSchema>;
