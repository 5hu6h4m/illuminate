import { apiError } from "@/lib/http";

/** Legacy endpoint is deliberately incapable of public registration lookups. */
export async function GET() { return apiError(404, "NOT_FOUND", "Not found."); }
export async function POST() { return apiError(410, "REGISTRATION_ENDPOINT_RETIRED", "Use the current registration flow."); }
export async function PATCH() { return apiError(410, "REGISTRATION_ENDPOINT_RETIRED", "Use the current admin workspace."); }
