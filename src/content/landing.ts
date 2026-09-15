import { event, isConfirmedText } from "@/config/event";

export const workshopJourney = [
  { number: "01", title: "Doors open & ignition", copy: "Check in, meet your cohort, and set the question you want to explore." },
  { number: "02", title: "Finding problems worth solving", copy: "Learn how founders spot real problems before jumping to solutions." },
  { number: "03", title: "From idea to frame", copy: "Shape a loose thought into a clear problem, user, and direction." },
  { number: "04", title: "Build, test, iterate", copy: "Hands-on working session with mentors to stress-test your direction." },
  { number: "05", title: "Pitch & perspective", copy: "Share your frame, get structured feedback, and see other approaches." },
  { number: "06", title: "Next move & close", copy: "Leave with a sharper next step, connections, and illumination certificate path." },
] as const;

export const confirmedBenefits = Object.entries(event.benefits)
  .filter(([, fact]) => isConfirmedText(fact))
  .map(([key, fact]) => ({ key, label: key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase()), copy: fact.value }));

export const faqItems = [
  { question: "What is Illuminate?", answer: event.identity.shortDescription },
  { question: "Who is organising it?", answer: `${event.organizer.name} is the host organiser. ${event.association.label}.` },
  { question: "When and where will it take place?", answer: "The schedule and venue will be announced here once finalised. The workshop is a 6-hour interactive experience hosted by E-Cell MET." },
  { question: "Who can attend?", answer: "Illuminate is open to everyone — any college, branch, or year. No prior startup experience is needed." },
  { question: "What is the fee?", answer: "Early Bird is ₹599 for the first 5 days of registration, then Regular ₹699. Your exact payable amount is shown in your secure payment instructions." },
  { question: "Will I get a certificate?", answer: "Certificate details will be listed here once confirmed with E-Cell IIT Bombay. Only confirmed inclusions are published on this site." },
  { question: "What is the timing of the workshop?", answer: "Illuminate is a 6-hour interactive workshop. Reporting time and session flow will be announced with the schedule." },
  { question: "How will payment work?", answer: "You will receive direct UPI instructions after registration. Pay exactly the shown amount, submit payment evidence, and your seat is confirmed only after manual verification. Your private status link shows real-time verification status." },
  { question: "Is the fee refundable?", answer: "Registration fees are non-refundable once payment has been verified." },
  { question: "Where can I find policy details?", answer: "Privacy, registration terms, and refund information are available in the site footer and before payment proof submission." },
  { question: "Whom do I contact for help?", answer: "Contact E-Cell MET Team at met.iot.ecell@gmail.com for registration or payment support." },
] as const;
