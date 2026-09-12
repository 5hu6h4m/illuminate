import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { MultiStepForm } from "@/components/MultiStepForm";

export default function RegisterPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-6 py-16 md:py-24">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-ember">
          <Link href="/" className="hover:underline">← Back home</Link>
        </p>
        <h1 className="mt-4 font-display text-4xl md:text-5xl">Register for Illuminate 2026</h1>
        <p className="mt-3 max-w-2xl leading-relaxed text-white/60">
          Four short steps — not one giant form. Your draft saves automatically in this browser.
        </p>
        <div className="mt-10">
          <MultiStepForm />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
