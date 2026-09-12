import { SkewButton } from "@/components/SkewButton";

export function SiteFooter() {
  return (
    <footer id="contact" className="border-t border-ember/15 bg-surface/60">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 text-center md:grid-cols-3 md:text-left">
        <div>
          <p className="font-display text-2xl tracking-wide">illuminate</p>
          <p className="mt-1 text-sm italic text-ember-soft">E-Cell IIT Bombay × E-Cell MET</p>
          <p className="mt-4 text-sm leading-relaxed text-white/55">
            6-hour interactive entrepreneurship workshop at MET Bhujbal Knowledge City.
          </p>
          <div className="mt-6 flex justify-center md:justify-start">
            <SkewButton href="/register" variant="violet">
              Register
            </SkewButton>
          </div>
        </div>
        <div className="text-sm">
          <p className="uppercase tracking-[0.2em] text-ember-soft">Collect only what&apos;s needed</p>
          <p className="mt-3 leading-relaxed text-white/55">
            No Aadhaar, PAN, address, bank, income or passwords. Name, email and phone power your
            certificate, communication and official submission.
          </p>
        </div>
        <div className="text-sm">
          <p className="uppercase tracking-[0.2em] text-ember-soft">Contact Us</p>
          <p className="mt-3 leading-relaxed text-white/55">
            E-Cell MET, Bhujbal Knowledge City, Nashik.
            <br />
            Write to us at the official E-Cell MET desk for bulk / college queries.
          </p>
          <p className="mt-3 text-xs leading-relaxed text-white/40">
            Campus visit &amp; free travel for Top 30 selected participants only, per eligibility.
            Early bird till 20 September 2026.
          </p>
        </div>
      </div>
      <div className="border-t border-ember/15 py-6 text-center text-xs text-white/40">
        © 2026 E-Cell MET · Illuminate · Powered by E-Cell, IIT Bombay
      </div>
    </footer>
  );
}
