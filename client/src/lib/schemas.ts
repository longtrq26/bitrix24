import { z } from "zod";

export const createContactSchema = z.object({
  NAME: z.string().min(1, "First Name is required."),
  LAST_NAME: z.string().optional(),

  PHONE: z
    .string()
    .regex(/^$|^\+84\d{9,10}$/, "Invalid Vietnamese phone number.")
    .optional(),

  EMAIL: z
    .string()
    .email("Invalid email format.")
    .optional()
    .refine((v) => v === undefined || v !== "", {
      message: "Email must not be empty string",
    }),

  WEB: z
    .string()
    .url("Invalid URL format.")
    .optional()
    .refine((v) => v === undefined || v !== "", {
      message: "Website must not be empty string",
    }),

  ADDRESS_1: z.string().optional(),
  ADDRESS_CITY: z.string().optional(),
  ADDRESS_REGION: z.string().optional(),
  ADDRESS_PROVINCE: z.string().optional(),

  requisite: z
    .object({
      NAME: z.string().optional(),
      RQ_BANK_NAME: z.string().optional(),
      RQ_ACC_NUM: z.string().optional(),
    })
    .optional(),
});
export type CreateContactFormValues = z.infer<typeof createContactSchema>;

export const updateRequisiteSchema = z
  .object({
    NAME: z.string().optional(),
    RQ_BANK_NAME: z.string().optional(),
    RQ_ACC_NUM: z.string().optional(),
  })
  .partial();
export type UpdateRequisiteFormValues = z.infer<typeof updateRequisiteSchema>;

export const updateContactSchema = z.object({
  NAME: z.string().optional(),
  LAST_NAME: z.string().optional(),
  SECOND_NAME: z.string().optional(),
  PHONE: z.string().optional(),
  EMAIL: z.string().email().optional().or(z.literal("")),
  WEB: z.string().url().optional().or(z.literal("")),
  ADDRESS_1: z.string().optional(),
  ADDRESS_CITY: z.string().optional(),
  ADDRESS_REGION: z.string().optional(),
  ADDRESS_PROVINCE: z.string().optional(),
  requisite: updateRequisiteSchema.optional().nullable(),
});
export type UpdateContactFormValues = z.infer<typeof updateContactSchema>;
