/** Content facts are separate from mutable event configuration in event.ts. */
export type ContentSource =
  | "official_current"
  | "met_confirmed"
  | "editorial_explanation"
  | "pending_poc"
  | "historical_only";

export type PublishState = "publishable" | "conditional" | "pending" | "internal_only";

export type ContentMeta = {
  source: ContentSource;
  publishState: PublishState;
  eventSpecificConfirmation?: "confirmed" | "pending_poc";
};

export type ContentItem = ContentMeta & { key: string };

/** Default public rendering must opt in through this selector. */
export function getPublishableContent<T extends ContentMeta>(items: readonly T[]): T[] {
  return items.filter((item) => item.publishState === "publishable" && item.source !== "pending_poc" && item.source !== "historical_only");
}
