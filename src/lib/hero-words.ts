// Keyword-driven headline styling for the cinematic hero.
// Styling follows keywords so copy edits in "@/content/illuminate" keep
// working: "idea" gets the serif-italic gradient accent, "business" gets extra
// weight with a violet period. Any other title renders as plain headline text.

const TRAILING_PUNCTUATION = /[.,!?;:]+$/;

export function stripTrailingPunctuation(word: string): string {
  return word.replace(TRAILING_PUNCTUATION, "");
}

export function heroWordClass(word: string): string {
  return stripTrailingPunctuation(word).toLowerCase() === "idea" ? "hero-word hero-accent" : "hero-word";
}

export function isBusinessToken(token: string): boolean {
  return stripTrailingPunctuation(token).toLowerCase() === "business";
}
