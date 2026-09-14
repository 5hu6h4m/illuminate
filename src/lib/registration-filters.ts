import "server-only";

/** Shared v2 predicates prevent development records entering production operations. */
export const currentRegistrationFilter = { schemaVersion: 2 } as const;
export const realRegistrationFilter = { schemaVersion: 2, isTest: { $ne: true }, environment: { $ne: "development" } } as const;
export const developmentTestRegistrationFilter = { schemaVersion: 2, isTest: true, environment: "development" } as const;

export function adminVisibleRegistrationFilter(developmentE2EEnabled: boolean) {
  return developmentE2EEnabled ? currentRegistrationFilter : realRegistrationFilter;
}
