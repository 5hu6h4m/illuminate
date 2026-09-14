import { event, isConfirmedText } from "@/config/event";

export const workshopJourney = [
  { number: "01", title: "Begin with the question", copy: "Make space for the problem you want to understand." },
  { number: "02", title: "Give ideas a frame", copy: "Move beyond a loose thought toward a clearer direction." },
  { number: "03", title: "Find the connection", copy: "See how people, context and collaboration shape progress." },
  { number: "04", title: "Leave with momentum", copy: "Carry a sharper lens into the work you do next." },
] as const;

export const confirmedBenefits = Object.entries(event.benefits)
  .filter(([, fact]) => isConfirmedText(fact))
  .map(([key, fact]) => ({ key, label: key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase()), copy: fact.value }));

export const faqItems = [
  { question: "What is Illuminate?", answer: event.identity.shortDescription },
  { question: "Who is organising it?", answer: `${event.organizer.name} is the host organiser. ${event.association.label}.` },
  { question: "When and where will it take place?", answer: "The schedule and venue will be announced here once finalised." },
  { question: "Who can attend?", answer: "Illuminate is open to everyone." },
  { question: "What will the registration include?", answer: "Confirmed registration inclusions will be listed here as they are finalized." },
  { question: "How will payment work?", answer: "You will receive direct UPI instructions after registration. Payment evidence is manually verified before a seat is confirmed." },
  { question: "Where can I find policy details?", answer: "Privacy, registration terms, and refund information are available in the site footer and before payment proof submission." },
] as const;
