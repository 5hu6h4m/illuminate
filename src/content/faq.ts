import { getPublishableContent, type ContentMeta } from "@/content/content-types";

export type FaqCategory = "understand" | "participation" | "workshop" | "registration" | "event";
export type IlluminateFaqItem = ContentMeta & { key: string; category: FaqCategory; question: string; answer: string };

export const faqItems = [
  { key: "what-is-illuminate", category: "understand", question: "What is Illuminate?", answer: "Illuminate introduces students to entrepreneurship and business thinking through topics such as problems, ideas, business models, startup finance and pitching.", source: "official_current", publishState: "publishable" },
  { key: "what-will-i-learn", category: "understand", question: "What will I learn?", answer: "You will be introduced to problem thinking, idea generation, team thinking, business models, startup finance, startup development and pitching.", source: "official_current", publishState: "publishable" },
  { key: "who-can-attend", category: "participation", question: "Who can attend?", answer: "Registration is open to everyone.", source: "met_confirmed", publishState: "publishable" },
  { key: "business-knowledge", category: "participation", question: "Do I need business knowledge?", answer: "No prior business knowledge is required to begin learning entrepreneurship fundamentals.", source: "official_current", publishState: "publishable" },
  { key: "workshop-facilitator", category: "workshop", question: "Who will conduct the workshop?", answer: "Workshop facilitator details will be announced once officially confirmed.", source: "pending_poc", publishState: "pending" },
  { key: "certificate", category: "workshop", question: "Will I receive a certificate?", answer: "Current general Illuminate material lists a certificate of participation. MET-specific issuer and wording are being confirmed.", source: "official_current", publishState: "conditional", eventSpecificConfirmation: "pending_poc" },
  { key: "startup-kit", category: "workshop", question: "Is there a startup kit?", answer: "Current general Illuminate material lists a startup kit. MET-specific contents and delivery details are being confirmed.", source: "official_current", publishState: "conditional", eventSpecificConfirmation: "pending_poc" },
  { key: "iitb-location", category: "event", question: "Is the workshop at IIT Bombay?", answer: "No. The MET edition is hosted locally by E-Cell MET, and its exact venue will be announced once confirmed.", source: "met_confirmed", publishState: "publishable" },
  { key: "campus-visit", category: "event", question: "Will attending take me to IIT Bombay?", answer: "An IIT Bombay campus visit is not confirmed and is not included in the current event information.", source: "met_confirmed", publishState: "publishable" },
  { key: "payment", category: "registration", question: "How does payment work?", answer: "After registration, you receive direct UPI instructions, submit payment proof, and wait for manual verification.", source: "met_confirmed", publishState: "publishable" },
  { key: "confirmation", category: "registration", question: "When is registration confirmed?", answer: "Registration is confirmed only after payment has been manually verified.", source: "met_confirmed", publishState: "publishable" },
  { key: "refund", category: "registration", question: "Is the fee refundable?", answer: "Registration fees are non-refundable once payment has been verified.", source: "met_confirmed", publishState: "publishable" },
  { key: "when-where", category: "event", question: "When and where is the event?", answer: "The event date, time and venue will be published once confirmed.", source: "met_confirmed", publishState: "publishable" },
  { key: "contact", category: "registration", question: "Who do I contact?", answer: "Contact E-Cell MET Team at met.iot.ecell@gmail.com for registration or payment support.", source: "met_confirmed", publishState: "publishable" },
  { key: "need-an-idea", category: "participation", question: "Do I need an idea?", answer: "This is waiting for POC confirmation.", source: "pending_poc", publishState: "pending" },
] as const satisfies readonly IlluminateFaqItem[];

export const getPublishableFaqItems = () => getPublishableContent(faqItems);
