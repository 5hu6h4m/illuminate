export type RegistrationFormConfig = {
  collectCollege: boolean;
  collegeRequired: boolean;
  fixedCollege: string | null;
  collectBranch: boolean;
  branchRequired: boolean;
  collectYear: boolean;
  yearRequired: boolean;
};

/**
 * Operational collection settings, separate from public event claims.
 * Keep this minimal until an organizer confirms a real operational need.
 */
export const registrationForm = {
  collectCollege: true,
  collegeRequired: true,
  fixedCollege: null,
  collectBranch: true,
  branchRequired: true,
  collectYear: true,
  yearRequired: true,
} as const satisfies RegistrationFormConfig;
