import { z } from "zod";

export const coverageSchema = z.object({
  address: z
    .string()
    .trim()
    .min(3, "Please enter at least 3 characters for the location or address")
    .max(160, "Address cannot exceed 160 characters"),
});

export type CoverageInput = z.infer<typeof coverageSchema>;

export const supportSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(80, "Name cannot exceed 80 characters"),
  email: z
    .string()
    .trim()
    .email("Please enter a valid email address")
    .max(120, "Email cannot exceed 120 characters"),
  subject: z
    .string()
    .trim()
    .min(3, "Subject must be at least 3 characters")
    .max(120, "Subject cannot exceed 120 characters"),
  message: z
    .string()
    .trim()
    .min(10, "Message must be at least 10 characters")
    .max(2000, "Message cannot exceed 2000 characters"),
});

export type SupportInput = z.infer<typeof supportSchema>;

export const newsletterSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Please enter a valid email address")
    .max(120, "Email cannot exceed 120 characters"),
});

export type NewsletterInput = z.infer<typeof newsletterSchema>;
