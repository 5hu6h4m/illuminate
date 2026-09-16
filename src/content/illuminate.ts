import { getPublishableContent, type ContentMeta } from "@/content/content-types";

const official = { source: "official_current", publishState: "publishable" } as const;

export const illuminateContent = {
  style: {
    voice: ["clear", "human", "beginner-friendly", "confident", "informative", "simple"],
    rules: ["Use one main idea per sentence.", "Explain jargon when it first appears.", "Use short paragraphs and concrete examples.", "Avoid fake urgency and exaggerated transformation claims."],
  },
  identity: {
    ...official,
    title: "What is Illuminate?",
    description: "Illuminate introduces students to how entrepreneurs identify problems, shape ideas, understand business models, think about startup money and communicate ideas.",
  },
  entrepreneurship: {
    ...official,
    title: "What is entrepreneurship?",
    description: "Entrepreneurship begins with noticing a real problem and asking whether it can be solved better. It connects people, a useful solution, the value it creates, how a business works, money and clear communication.",
  },
  phaseOne: {
    hero: {
      ...official,
      title: "Learn how an idea becomes a business.",
      description: "Illuminate is an entrepreneurship workshop where you explore how entrepreneurs spot problems, shape ideas, understand how a business could work, think about money and explain ideas clearly.",
    },
    entrepreneurshipExplained: {
      source: "editorial_explanation",
      publishState: "publishable",
      title: "Entrepreneurship starts with one simple question: Can this problem be solved better?",
      description: "An entrepreneur notices a real problem, understands who faces it, thinks of a useful solution, and works out how that solution can create value and keep working over time.",
      closing: "Illuminate introduces you to this way of thinking.",
    },
    thinkingModel: [
      { key: "notice", label: "Notice", description: "a problem" },
      { key: "understand", label: "Understand", description: "who faces it" },
      { key: "solve", label: "Solve", description: "it better" },
      { key: "create-value", label: "Create value", description: "for people" },
    ],
    examples: ["Long queues", "Finding project teammates", "Everyday campus problems"],
  },
  whyItMatters: {
    ...official,
    title: "Why does it matter?",
    description: "This way of thinking can help with college projects, hackathons, competitions, teamwork and explaining an idea clearly.",
  },
  curriculum: [
    { ...official, key: "spot-problem", title: "Spot the Problem", description: "Understand why useful ideas usually begin with a real problem.", officialTopic: "Idea Generation & Problem" },
    { ...official, key: "shape-idea", title: "Shape the Idea", description: "Turn an early thought into a clearer idea for a person or group.", officialTopic: "Problem-Solution Thinking" },
    { ...official, key: "team-thinking", title: "Think as a Team", description: "See how different people can work together while building an idea.", officialTopic: "Team Formation" },
    { ...official, key: "map-business", title: "Map the Business", description: "Get introduced to the Business Model Canvas, a simple map of how a business might work.", officialTopic: "Business Model Canvas" },
    { ...official, key: "understand-money", title: "Understand the Money", description: "Learn the basic questions behind startup money and costs.", officialTopic: "Startup Finance" },
    { ...official, key: "build-direction", title: "Build the Direction", description: "Explore how an idea can develop step by step.", officialTopic: "Startup Development" },
    { ...official, key: "tell-story", title: "Tell the Story", description: "Understand how to structure and explain an idea clearly.", officialTopic: "Pitching & Q&A" },
  ],
  workshopJourney: {
    ...official,
    journeyType: "conceptual",
    supportCopy: "Exact activities and session timings will be published once confirmed.",
    steps: ["Entrepreneurship basics", "Team thinking", "Problem and idea", "Business model", "Startup finance", "Startup development", "Pitching and Q&A"],
  },
  participantValue: [
    { ...official, key: "startup-thinking", title: "Startup Thinking", description: "Understand how a real problem can begin turning into a possible business idea." },
    { ...official, key: "business-framework", title: "Business Framework", description: "Get introduced to tools such as the Business Model Canvas for organising how a business might work." },
    { ...official, key: "communication", title: "Communication", description: "Understand how startup ideas are structured and explained clearly." },
  ],
  registrationProcess: {
    source: "met_confirmed",
    publishState: "publishable",
    title: "How registration works",
    description: "A clear process from your details to confirmed registration.",
    steps: [
      { key: "details", label: "Your details", description: "Enter the information needed for your registration.", owner: "You" },
      { key: "review", label: "Review", description: "Check your details before continuing.", owner: "You" },
      { key: "pay", label: "Pay", description: "Pay the exact amount shown using the UPI details on your payment screen.", owner: "You" },
      { key: "submit-proof", label: "Submit proof", description: "Add your transaction reference and payment screenshot.", owner: "You" },
      { key: "verification", label: "Verification", description: "E-Cell MET manually checks the submitted payment details.", owner: "E-Cell MET" },
      { key: "confirmed", label: "Confirmed", description: "Your registration is confirmed only after payment is verified.", owner: "Registration" },
    ],
    pendingMessage: "Your payment is awaiting verification, so registration is not confirmed yet.",
    confirmationMessage: "After payment is verified, your registration is confirmed. You can leave the website after submitting payment details, and we’ll email you when confirmation is complete.",
    resubmissionMessage: "If submitted payment details need correction, you can return to your private registration status page and resubmit them.",
  },
  finalCta: {
    source: "editorial_explanation",
    publishState: "publishable",
    title: "Curious how an idea becomes something real?",
    description: "Start with the fundamentals. Understand the problem. Shape the idea. Learn how the business fits together.",
    assurances: ["Open to everyone", "Manual payment verification", "Confirmation by email"],
  },
  participantBenefits: [
    { key: "certificate", title: "Certificate of Participation", description: "Current general Illuminate material lists a certificate; MET-specific issuer and wording are still being confirmed.", source: "official_current", publishState: "conditional", eventSpecificConfirmation: "pending_poc" },
    { key: "startup-kit", title: "Comprehensive Startup Kit", description: "Current general Illuminate material lists a startup kit; MET-specific contents and delivery details are still being confirmed.", source: "official_current", publishState: "conditional", eventSpecificConfirmation: "pending_poc" },
  ],
  isThisForMe: [
    { key: "first-year", question: "I'm only in first year.", answer: "Illuminate is open to everyone, and the learning starts with entrepreneurship fundamentals.", source: "met_confirmed", publishState: "publishable" },
    { key: "not-business", question: "I'm not from a business branch.", answer: "Registration is open to everyone, and the content introduces the basics in simple language.", source: "met_confirmed", publishState: "publishable" },
    { key: "new-to-startups", question: "I've never studied startups.", answer: "The curriculum begins with entrepreneurship fundamentals and problem thinking.", source: "official_current", publishState: "publishable" },
    { key: "not-starting-now", question: "I don't plan to start a company tomorrow.", answer: "You can still learn a useful way to think about problems, ideas, teamwork and communication.", source: "editorial_explanation", publishState: "publishable" },
    { key: "need-an-idea", question: "Do I need an idea?", answer: "Whether participants need an existing idea is waiting for POC confirmation.", source: "pending_poc", publishState: "pending" },
  ],
  roles: {
    iitBombay: { ...official, title: "E-Cell IIT Bombay", description: "Illuminate initiative and entrepreneurship-program side." },
    met: { source: "met_confirmed", publishState: "publishable", title: "E-Cell MET", description: "Local host, participant registration, local communication and local event coordination." },
  },
  speaker: { source: "pending_poc", publishState: "pending", status: "pending_poc", name: null, role: null, organisation: null, bio: null, image: null, placeholder: "Workshop facilitator details will be announced once officially confirmed." },
} as const satisfies {
  style: { voice: readonly string[]; rules: readonly string[] };
  identity: ContentMeta & { title: string; description: string };
  entrepreneurship: ContentMeta & { title: string; description: string };
  phaseOne: {
    hero: ContentMeta & { title: string; description: string };
    entrepreneurshipExplained: ContentMeta & { title: string; description: string; closing: string };
    thinkingModel: readonly { key: string; label: string; description: string }[];
    examples: readonly string[];
  };
  whyItMatters: ContentMeta & { title: string; description: string };
  curriculum: readonly (ContentMeta & { key: string; title: string; description: string; officialTopic: string })[];
  workshopJourney: ContentMeta & { journeyType: "conceptual"; supportCopy: string; steps: readonly string[] };
  participantValue: readonly (ContentMeta & { key: string; title: string; description: string })[];
  registrationProcess: ContentMeta & {
    title: string;
    description: string;
    steps: readonly { key: string; label: string; description: string; owner: "You" | "E-Cell MET" | "Registration" }[];
    pendingMessage: string;
    confirmationMessage: string;
    resubmissionMessage: string;
  };
  finalCta: ContentMeta & { title: string; description: string; assurances: readonly string[] };
  participantBenefits: readonly (ContentMeta & { key: string; title: string; description: string })[];
  isThisForMe: readonly (ContentMeta & { key: string; question: string; answer: string })[];
  roles: Record<string, ContentMeta & { title: string; description: string }>;
  speaker: ContentMeta & { status: "pending_poc"; name: null; role: null; organisation: null; bio: null; image: null; placeholder: string };
};

export const getPublishableCurriculum = () => getPublishableContent(illuminateContent.curriculum);
export const getConfirmedParticipantBenefits = () => getPublishableContent(illuminateContent.participantBenefits);
