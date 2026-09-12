export function SiteFooter() {
  return (
    <footer className="border-t border-white/8">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 md:grid-cols-3">
        <div>
          <p className="font-display text-xl">ILLUMINATE 2026</p>
          <p className="mt-3 text-sm leading-relaxed text-white/55">
            E-Cell IIT Bombay × E-Cell MET Bhujbal Knowledge City. 6-hour interactive
            entrepreneurship workshop.
          </p>
        </div>
        <div className="text-sm">
          <p className="uppercase tracking-[0.2em] text-white/45">Collect only what&apos;s needed</p>
          <p className="mt-3 leading-relaxed text-white/60">
            No Aadhaar, PAN, address, bank, income or passwords. Name, email and phone power your
            certificate, communication and official submission.
          </p>
        </div>
        <div className="text-sm">
          <p className="uppercase tracking-[0.2em] text-white/45">Good to know</p>
          <p className="mt-3 leading-relaxed text-white/60">
            Campus visit &amp; free travel for Top 30 selected participants only, per eligibility.
            Early bird till 20 September 2026.
          </p>
        </div>
      </div>
      <div className="border-t border-white/8 py-6 text-center text-xs text-white/40">
        © 2026 E-Cell MET · Illuminate · Made with breathing room
      </div>
    </footer>
  );
}
