/**
 * Admin-only E-cell member display override.
 *
 * Payment truth (`payment.snapshot.expectedAmount`) stays immutable.
 * When an admin flags a registration as an E-cell member, the admin panel
 * displays ₹699 instead of ₹599. No participant-facing payment surface
 * (QR, UPI URI, emails, /api/payment/*) may use this helper.
 */

export const ECELL_STANDARD_AMOUNT = 599;
export const ECELL_MEMBER_AMOUNT = 699;

export function isEcellMember(value: unknown): value is true {
  return value === true;
}

export function getDisplayAmount(
  snapshotAmount: number | null | undefined,
  ecellMember?: boolean | null,
): number | null {
  if (snapshotAmount === null || snapshotAmount === undefined) return null;
  if (isEcellMember(ecellMember) && snapshotAmount === ECELL_STANDARD_AMOUNT) return ECELL_MEMBER_AMOUNT;
  return snapshotAmount;
}

export function isEcellOverrideApplied(
  snapshotAmount: number | null | undefined,
  ecellMember?: boolean | null,
): boolean {
  return isEcellMember(ecellMember) && snapshotAmount === ECELL_STANDARD_AMOUNT;
}
