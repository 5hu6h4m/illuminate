import type { Metadata } from "next";
import { PaymentStatusClient } from "@/components/registration/PaymentStatusClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer", title: "Registration status | Illuminate" };
export default async function RegistrationStatusPage({ params }: { params: Promise<{ token: string }> }) { return <PaymentStatusClient token={(await params).token} />; }
