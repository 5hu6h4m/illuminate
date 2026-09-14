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
  collectCollege: false,
  collegeRequired: false,
  fixedCollege: null,
  collectBranch: false,
  branchRequired: false,
  collectYear: false,
  yearRequired: false,
} as const satisfies RegistrationFormConfig;
