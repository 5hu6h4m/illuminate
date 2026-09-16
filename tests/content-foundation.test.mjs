import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getPublishableContent } from "../src/content/content-types.ts";
import { canteenJourney } from "../src/content/student-examples.ts";
import { illuminateContent } from "../src/content/illuminate.ts";
import { faqItems } from "../src/content/faq.ts";
import { event, isConfirmedText } from "../src/config/event.ts";

test("only publishable curriculum entries are selected", () => {
  const curriculum = getPublishableContent(illuminateContent.curriculum);
  assert.equal(curriculum.length, 7);
  assert.ok(curriculum.every((item) => item.source === "official_current"));
});

test("Phase 2 keeps the seven approved learning modules in order", () => {
  assert.deepEqual(
    illuminateContent.curriculum.map((module) => module.key),
    ["spot-problem", "shape-idea", "team-thinking", "map-business", "understand-money", "build-direction", "tell-story"],
  );
  assert.ok(illuminateContent.curriculum.every((module) => module.publishState === "publishable" && module.source !== "pending_poc"));
});

test("Phase 1 content explains entrepreneurship without turning the Phase 2 journey public", () => {
  const phaseOne = illuminateContent.phaseOne;

  assert.equal(phaseOne.hero.title, "Learn how an idea becomes a business.");
  assert.equal(phaseOne.thinkingModel.length, 4);
  assert.deepEqual(
    phaseOne.thinkingModel.map((step) => step.label),
    ["Notice", "Understand", "Solve", "Create value"],
  );
  assert.equal(phaseOne.examples.length, 3);
  assert.doesNotMatch(JSON.stringify(phaseOne), /canteen|pre-order|BMC|MVP|GTM/i);
});

test("POC-pending content cannot become public through the default selector", () => {
  const benefits = getPublishableContent(illuminateContent.participantBenefits);
  assert.equal(benefits.length, 0);
  assert.equal(illuminateContent.speaker.publishState, "pending");
  assert.equal(illuminateContent.speaker.source, "pending_poc");
});

test("the canteen journey remains an editorial educational example", () => {
  assert.equal(canteenJourney.source, "editorial_explanation");
  assert.equal(canteenJourney.publishState, "publishable");
  assert.match(canteenJourney.notAWorkshopPromise, /not a promise/i);
});

test("public FAQ excludes pending POC questions and invented logistics", () => {
  const publicFaq = getPublishableContent(faqItems);
  assert.ok(publicFaq.every((item) => item.publishState === "publishable"));
  assert.ok(publicFaq.every((item) => item.source !== "pending_poc"));
  assert.equal(publicFaq.some((item) => item.question === "Do I need an idea?"), false);
  assert.ok(publicFaq.some((item) => item.question === "When and where is the event?"));
  assert.doesNotMatch(JSON.stringify(publicFaq), /11 AM|6 hours|₹799|70 participants/);
});

test("final decision support keeps guarded FAQ topics unpublished", () => {
  const publicFaqKeys = new Set(getPublishableContent(faqItems).map((item) => item.key));
  assert.equal(publicFaqKeys.has("need-an-idea"), false);
  assert.equal(publicFaqKeys.has("workshop-facilitator"), false);
  assert.equal(publicFaqKeys.has("certificate"), false);
  assert.equal(publicFaqKeys.has("startup-kit"), false);
  assert.ok(illuminateContent.finalCta.title);
  assert.doesNotMatch(JSON.stringify(illuminateContent.finalCta), /₹599|₹699|limited|guaranteed/i);
});

test("the public registration explanation keeps proof submission separate from verification", () => {
  const process = illuminateContent.registrationProcess;
  assert.deepEqual(process.steps.map((step) => step.key), ["details", "review", "pay", "submit-proof", "verification", "confirmed"]);
  assert.match(process.pendingMessage, /not confirmed/i);
  assert.match(process.pendingMessage, /verification/i);
  assert.match(process.confirmationMessage, /after payment is verified/i);
});

test("event detail facts keep manual registration control separate from pending logistics", () => {
  assert.equal(event.format.value, "Offline workshop");
  assert.equal(event.registration.eligibility.value, "Open to everyone");
  assert.equal(event.fee.pricing.earlyBirdAmount, 599);
  assert.equal(event.fee.pricing.regularAmount, 699);
  assert.equal(isConfirmedText(event.registration.deadline), false);
  assert.equal(isConfirmedText(event.schedule.date), false);
  assert.equal(isConfirmedText(event.schedule.time), false);
  assert.equal(isConfirmedText(event.schedule.venue), false);
  assert.equal(illuminateContent.speaker.publishState, "pending");
});

test("public pricing copy does not promise an automatic Early Bird cutoff", () => {
  const homepage = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  const registrationReview = readFileSync(new URL("../src/components/registration/RegistrationWizard.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(homepage, /first\s+\{?[^\n]*days|first 120 hours|five days/i);
  assert.doesNotMatch(registrationReview, /first 120 hours|five days/i);
});
