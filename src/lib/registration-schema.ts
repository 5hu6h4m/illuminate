import { z } from "zod";
import { BRANCHES, COLLEGE_LOCKED, YEARS } from "./registration";

const indianMobile = z
  .string()
  .trim()
  .transform((v) => v.replace(/\D/g, "").slice(-10))
  .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number."));

export const CreateRegistrationSchema = z.object({
  fullName: z.string().trim().min(3).max(120),
  email: z.string().trim().toLowerCase().pipe(z.email()),
  mobile: indianMobile,
  whatsapp: indianMobile,
  gender: z.string().max(20).optional(),
  college: z.literal(COLLEGE_LOCKED),
  studentId: z.string().trim().min(2).max(60),
  branch: z.enum(BRANCHES),
  year: z.enum(YEARS),
  division: z.string().trim().max(20).optional(),
  interests: z.array(z.string().max(60)).max(20).default([]),
  hasIdea: z.string().max(60).default("I'm exploring ideas"),
  ideaText: z.string().trim().max(500).optional(),
  attendedStartupEvent: z.string().max(20).default("No"),
  attendedEcell: z.string().max(20).default("No"),
  campusVisit: z.string().max(30).default("Yes"),
  willingToTravel: z.string().max(30).default("Yes"),
  emergencyName: z.string().trim().min(1).max(120),
  emergencyPhone: indianMobile,
  accessibility: z.string().trim().max(300).optional(),
  amountPaid: z.number().int().min(0).max(100000),
  paymentStatus: z.enum(["paid", "pending", "awaiting_verification"]),
  paymentId: z.string().max(120).optional(),
  utr: z.string().trim().max(60).optional(),
  paymentScreenshot: z.string().max(2_500_000).optional(),
});

export type CreateRegistrationInput = z.infer<typeof CreateRegistrationSchema>;
