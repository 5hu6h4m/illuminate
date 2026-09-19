import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(new URL("../src/app/api/admin/registrations/[publicId]/route.ts", import.meta.url), "utf8");
const schemas = readFileSync(new URL("../src/lib/registration-v2.ts", import.meta.url), "utf8");
const service = readFileSync(new URL("../src/lib/payment-flow-service.ts", import.meta.url), "utf8");
const listRoute = readFileSync(new URL("../src/app/api/admin/registrations/route.ts", import.meta.url), "utf8");
const exportRoute = readFileSync(new URL("../src/app/api/admin/export/route.ts", import.meta.url), "utf8");
const helper = readFileSync(new URL("../src/lib/ecell-pricing.ts", import.meta.url), "utf8");
const modal = readFileSync(new URL("../src/components/admin/ReviewModal.tsx", import.meta.url), "utf8");
const table = readFileSync(new URL("../src/components/admin/QueueTable.tsx", import.meta.url), "utf8");
const hook = readFileSync(new URL("../src/hooks/admin/useDashboard.ts", import.meta.url), "utf8");
const paymentStatus = readFileSync(new URL("../src/components/registration/PaymentStatusClient.tsx", import.meta.url), "utf8");
const paymentApi = readFileSync(new URL("../src/app/api/payment/status/[token]/route.ts", import.meta.url), "utf8");

test("ecell toggle has strict zod schema and allowlist update", () => {
  assert.match(schemas, /AdminEcellSchema/);
  assert.match(schemas, /ecellMember: z\.boolean/);
  assert.match(schemas, /\.strict\(\)/);
  assert.match(route, /AdminEcellSchema/);
  assert.match(route, /action.*ecell/);
  assert.match(service, /setEcellMemberFlag/);
  assert.match(service, /\$set: \{ ecellMember:/);
  const ecellFn = service.slice(service.indexOf("setEcellMemberFlag"));
  assert.doesNotMatch(ecellFn, /payment\.snapshot/);
  assert.doesNotMatch(ecellFn, /"payment\./);
});

test("ecell toggle requires admin auth and audits without emails", () => {
  assert.match(route, /isSameOrigin/);
  assert.match(route, /isAdminAuthenticated/);
  assert.match(route, /enforceAdminEcellRateLimit/);
  assert.match(route, /429/);
  assert.match(route, /admin_ecell_flag_changed/);
  assert.match(route, /admin_audit/);
  assert.match(schemas, /ecell_flag_changed/);
  assert.doesNotMatch(service.match(/setEcellMemberFlag[\s\S]*$/)?.[0] ?? "", /dispatchTransactionalEmail/);
});

test("ecell display override is admin-only and payment system untouched", () => {
  assert.match(helper, /ECELL_STANDARD_AMOUNT/);
  assert.match(helper, /ECELL_MEMBER_AMOUNT/);
  assert.match(helper, /getDisplayAmount/);
  assert.match(listRoute, /ecellMember/);
  assert.match(listRoute, /ECELL_STANDARD_AMOUNT/);
  assert.match(listRoute, /ECELL_MEMBER_AMOUNT/);
  assert.match(exportRoute, /getDisplayAmount/);
  assert.match(exportRoute, /E-cell Member/);
  assert.match(modal, /E-cell member/);
  assert.match(modal, /onToggleEcell/);
  assert.match(modal, /getDisplayAmount/);
  assert.doesNotMatch(modal, /aria-live="polite"\s*\n?\s*onClick/);
  assert.match(table, /E-cell/);
  assert.match(hook, /toggleEcell/);
  assert.match(hook, /action.*ecell/);
  assert.doesNotMatch(paymentStatus, /ecellMember|getDisplayAmount|ECELL_/);
  assert.doesNotMatch(paymentApi, /ecellMember|getDisplayAmount|ECELL_/);
});
