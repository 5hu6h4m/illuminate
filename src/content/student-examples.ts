import type { ContentMeta } from "@/content/content-types";

export const canteenJourney = {
  key: "canteen-preorder",
  title: "From a canteen queue to a possible business idea",
  source: "editorial_explanation",
  publishState: "publishable",
  notAWorkshopPromise: "This is an educational example, not a promise that the workshop will use this exact activity.",
  stages: [
    { key: "problem", label: "Problem", description: "Students lose much of their lunch break waiting in a canteen queue." },
    { key: "idea", label: "Idea", description: "A pre-order meal system could let students choose food before reaching the counter." },
    { key: "people", label: "People", description: "Students and canteen staff would both need the system to work well." },
    { key: "value", label: "Value", description: "Less waiting and smoother ordering could help both groups." },
    { key: "business", label: "Business question", description: "How could the system operate in a way that lasts?" },
    { key: "money", label: "Money question", description: "What would it cost to build and run, and where could revenue come from?" },
    { key: "pitch", label: "Pitch question", description: "Can the idea be explained clearly to other people?" },
  ],
} as const satisfies ContentMeta & { key: string; title: string; notAWorkshopPromise: string; stages: readonly { key: string; label: string; description: string }[] };
