import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { event } from "@/config/event";

const manrope = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-manrope", display: "swap" });

export const metadata: Metadata = {
  title: `${event.identity.name} ${event.identity.edition} | ${event.organizer.name}`,
  description: event.identity.shortDescription,
  icons: { icon: "/images/ecell-logo.png", apple: "/images/ecell-logo.png" },
  openGraph: {
    type: "website",
    title: `${event.identity.name} ${event.identity.edition} | ${event.organizer.name}`,
    description: event.identity.shortDescription,
    siteName: event.identity.name,
  },
  twitter: {
    card: "summary",
    title: `${event.identity.name} ${event.identity.edition} | ${event.organizer.name}`,
    description: event.identity.shortDescription,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" className={`h-full antialiased ${manrope.variable}`}><body className="min-h-full bg-ink text-cream font-body"><noscript><style>{`.reveal,.flip-reveal{opacity:1 !important;transform:none !important}`}</style></noscript>{children}</body></html>;
}
