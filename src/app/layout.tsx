import type { Metadata } from "next";
import { New_Rocker, Piazzolla } from "next/font/google";
import "./globals.css";

const display = New_Rocker({ weight: "400", subsets: ["latin"], variable: "--font-display" });
const body = Piazzolla({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "Illuminate 2026 | E-Cell IIT Bombay × E-Cell MET",
  description:
    "6-hour interactive entrepreneurship workshop. Learn. Build. Network. IIT Bombay certificate, campus visit opportunity, startup kit.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="min-h-full bg-ink text-cream font-body">
        <noscript>
          <style>{`.reveal,.flip-reveal{opacity:1 !important;transform:none !important}`}</style>
        </noscript>
        {children}
      </body>
    </html>
  );
}
