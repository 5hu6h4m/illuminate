import { NextResponse } from "next/server";
import { getEffectiveRegistrationAvailability } from "@/lib/registration-availability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public registration gate for landing-page clients. No auth, no PII.
 * `manuallyClosed=true` means the admin override is active; clients show
 * the Closed dialog and never navigate to /register.
 */
export async function GET() {
  try {
    const state = await getEffectiveRegistrationAvailability();
    return NextResponse.json(
      { data: { available: state.available, manuallyClosed: state.manuallyClosed } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { data: { available: false, manuallyClosed: false } },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
