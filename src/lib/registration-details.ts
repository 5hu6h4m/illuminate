import { z } from "zod";
import { registrationForm, type RegistrationFormConfig } from "@/config/registration";

export type RegistrationDetailsDraft = {
  fullName: string;
  email: string;
  phone: string;
  college: string;
  branch: string;
  year: string;
};

export const emptyRegistrationDetails: RegistrationDetailsDraft = {
  fullName: "",
  email: "",
  phone: "",
  college: "",
  branch: "",
  year: "",
};

export function normalizeIndianPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("91") && digits.length === 12 ? digits.slice(2) : digits;
}

export function formatIndianPhone(value: string): string {
  const normalized = normalizeIndianPhone(value);
  return normalized.length === 10
    ? `+91 ${normalized.slice(0, 5)} ${normalized.slice(5)}`
    : value.trim();
}

const optionalText = z.string().trim().max(120);

export function createRegistrationDetailsSchema(config: RegistrationFormConfig = registrationForm) {
  const college = config.collectCollege
    ? z.string().trim().min(config.collegeRequired ? 2 : 0, "Enter your college name.").max(160)
    : optionalText;
  const branch = config.collectBranch
    ? z.string().trim().min(config.branchRequired ? 2 : 0, "Enter your department or branch.").max(120)
    : optionalText;
  const year = config.collectYear
    ? z.string().trim().min(config.yearRequired ? 1 : 0, "Enter your year of study.").max(80)
    : optionalText;

  return z.object({
    fullName: z.string().trim().min(2, "Enter your full name.").max(120, "Use a name under 120 characters."),
    email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
    phone: z.string().transform(normalizeIndianPhone).pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number.")),
    college,
    branch,
    year,
  });
}

export const RegistrationDetailsSchema = createRegistrationDetailsSchema();
export type RegistrationDetails = z.infer<typeof RegistrationDetailsSchema>;
