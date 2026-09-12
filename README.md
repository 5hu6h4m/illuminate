# Illuminate 2026 — E-Cell IIT Bombay × E-Cell MET

6-hour interactive entrepreneurship workshop site. Next.js 15 + TypeScript + Tailwind.

## Run

```bash
npm install
npm run dev     # http://localhost:3000
npm run build
```

Routes: `/` landing · `/register` 4-step form · `/success?id=` confirmation · `/admin` dashboard (passcode `met2026` demo).

## Flow

Landing (₹999 → ₹699 till 20 Sept 2026) → Personal → Academic (MET locked) → Profile →
Travel + consents → Payment placeholder (gateway hook in `payOnline()` + manual UTR) →
Reg ID `ILL-MET-2026-XXXXX` → success + WhatsApp + `.ics`.

## Wire up for real

- Payments: plug Razorpay order + webhook verify into `src/components/MultiStepForm.tsx:payOnline`.
  UTR path already marks `awaiting_verification` for admin.
- Email/WhatsApp: Resend + group link in `src/app/success/page.tsx` (link placeholder present).
- DB/Auth: `src/lib/registration.ts` is Supabase-ready; admin gate is demo-only — add real auth.
- Images: drop files into `public/images/` (`hero-bg.jpg`, `campus-iitb.jpg`, `startup-kit.png`, logos).

## Export

Admin → Export Participants (CSV) with IITB columns: Reg ID, Name, Email, Phone, College,
Student ID, Branch, Year, Campus interest, Travel interest, Payment status, Date.
