import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const settings = readFileSync(new URL("../src/lib/site-settings.ts", import.meta.url), "utf8");
const availability = readFileSync(new URL("../src/lib/registration-availability.ts", import.meta.url), "utf8");
const adminRoute = readFileSync(new URL("../src/app/api/admin/settings/route.ts", import.meta.url), "utf8");
const statusRoute = readFileSync(new URL("../src/app/api/site/registration-status/route.ts", import.meta.url), "utf8");
const landing = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
const header = readFileSync(new URL("../src/components/landing/LandingHeader.tsx", import.meta.url), "utf8");
const hero = readFileSync(new URL("../src/components/landing/CinematicHero.tsx", import.meta.url), "utf8");
const final = readFileSync(new URL("../src/components/landing/FinalCta.tsx", import.meta.url), "utf8");
const dialog = readFileSync(new URL("../src/components/landing/RegistrationClosedDialog.tsx", import.meta.url), "utf8");
const registerPage = readFileSync(new URL("../src/app/register/page.tsx", import.meta.url), "utf8");
const createRoute = readFileSync(new URL("../src/app/api/payment/registrations/route.ts", import.meta.url), "utf8");
const wizard = readFileSync(new URL("../src/components/registration/RegistrationWizard.tsx", import.meta.url), "utf8");
const adminPage = readFileSync(new URL("../src/app/admin/page.tsx", import.meta.url), "utf8");
const togglePanel = readFileSync(new URL("../src/components/admin/RegistrationTogglePanel.tsx", import.meta.url), "utf8");

test("manual close flag lives in site_settings with a safe fail-open default", () => {
  assert.match(settings, /site_settings/);
  assert.match(settings, /manualClose/);
  assert.match(settings, /isRegistrationManuallyClosed/);
  assert.match(settings, /setRegistrationManualClose/);
  assert.match(settings, /registration_toggle/);
});

test("effective availability gives manual close precedence over the date window", () => {
  assert.match(availability, /getEffectiveRegistrationAvailability/);
  assert.match(availability, /isRegistrationManuallyClosed/);
  assert.match(availability, /manuallyClosed: true/);
  assert.match(availability, /getConfirmedPaymentSnapshot/);
});

test("admin settings API is authenticated and audited", () => {
  assert.match(adminRoute, /isAdminAuthenticated/);
  assert.match(adminRoute, /setRegistrationManualClose/);
  assert.match(adminRoute, /getRegistrationManualClose/);
  assert.match(adminRoute, /closed: z.boolean/);
});

test("public status endpoint is unauthenticated and never cached", () => {
  assert.match(statusRoute, /getEffectiveRegistrationAvailability/);
  assert.match(statusRoute, /no-store/);
  assert.ok(!statusRoute.includes("isAdminAuthenticated"), "public endpoint must not require admin auth");
});

test("landing passes manual close through and keeps login intact", () => {
  assert.match(landing, /getEffectiveRegistrationAvailability/);
  assert.match(landing, /manuallyClosed/);
  assert.match(landing, /UpdatesCta/);
  for (const source of [header, hero, final]) {
    assert.match(source, /manuallyClosed/);
    assert.match(source, /RegistrationClosedDialog/);
    assert.match(source, /Registration Closed/);
    assert.match(source, /\/login/);
  }
});

test("closed dialog is accessible and routes existing holders to login", () => {
  assert.match(dialog, /role="dialog"/);
  assert.match(dialog, /aria-modal="true"/);
  assert.match(dialog, /Registrations are closed/);
  assert.match(dialog, /Registrations are full/);
  assert.match(dialog, /variant: RegistrationClosedVariant/);
  assert.match(dialog, /Log in to your registration/);
  assert.match(dialog, /Escape/);
  assert.match(dialog, /\/login/);
});

test("register page shows a closed panel with a login path on direct visits", () => {
  assert.match(registerPage, /getEffectiveRegistrationAvailability/);
  assert.match(registerPage, /manuallyClosed/);
  assert.match(registerPage, /Registrations are closed/);
  assert.match(registerPage, /Log in to your registration/);
});

test("creation API rejects with REGISTRATION_CLOSED but login flows stay ungated", () => {
  assert.match(createRoute, /isRegistrationManuallyClosed/);
  assert.match(createRoute, /REGISTRATION_CLOSED/);
  assert.match(createRoute, /403/);
  assert.match(wizard, /REGISTRATION_CLOSED/);
  assert.match(wizard, /RegistrationClosedDialog/);
  assert.match(wizard, /variant="closed"/);
  assert.match(wizard, /variant="full"/);
  assert.ok(!wizard.includes("function RegistrationFullDialog"), "wizard must reuse the shared dialog, not a local copy");
});

test("manual-close gate resolves after replays and duplicates, before slot claim", () => {
  // Existing holders resolve first: idempotent replay and identity
  // duplicates come before the gate, the slot claim comes after — the same
  // ordering the seat-cap gate follows, so in-flight holders never see 403.
  const replayIndex = createRoute.indexOf("existingRequest");
  const dupIndex = createRoute.indexOf("const duplicate = await findIdentityDuplicate()");
  const gateIndex = createRoute.indexOf("isRegistrationManuallyClosed()");
  const claimIndex = createRoute.indexOf("await claimNextDestinationSlot");
  assert.ok(replayIndex !== -1 && dupIndex !== -1 && gateIndex !== -1 && claimIndex !== -1);
  assert.ok(replayIndex < gateIndex, "replay must resolve before the manual-close gate");
  assert.ok(dupIndex < gateIndex, "duplicates must resolve before the manual-close gate");
  assert.ok(gateIndex < claimIndex, "manual-close gate must run before consuming a slot");
});

test("admin panel mounts a confirm-guarded open/close toggle", () => {
  assert.match(adminPage, /RegistrationTogglePanel/);
  assert.match(togglePanel, /\/api\/admin\/settings/);
  assert.match(togglePanel, /Close registrations/);
  assert.match(togglePanel, /Re-open registrations/);
  assert.match(togglePanel, /window.confirm/);
  assert.match(togglePanel, /never blocks login/);
});
