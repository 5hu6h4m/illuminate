/**
 * Client-side registration continuation helpers.
 *
 * Security posture (deliberate):
 * - The idempotency key is persisted to `sessionStorage` (same origin,
 *   tab-lifetime) keyed by the normalized identity fingerprint. A reload
 *   retry for *identical* details therefore replays instead of conflicting.
 *   The server still enforces exact-identity replay and never returns a
 *   stranger's link, so this storage cannot become an enumeration oracle.
 * - The issued `statusUrl` is the holder's own bearer capability (it also
 *   lives in browser history). Saving it to `localStorage` only resurfaces
 *   it to the same browser that created it.
 * - All storage access is fail-closed: quota errors, private-mode denial,
 *   and malformed payloads degrade to the previous behavior (fresh key,
 *   no banner), never to a crash or a wrong link.
 */

export type PersistedAttempt = { key: string; fingerprint: string };
export type SavedRegistration = { publicId: string; statusUrl: string; savedAt: string };

export const ATTEMPT_STORAGE_KEY = "illuminate.registrationAttempt.v1";
export const SAVED_STORAGE_KEY = "illuminate.savedRegistration.v1";

export type MinimalStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

function readJson(storage: MinimalStorage, key: string): unknown {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export function loadPersistedAttempt(storage: MinimalStorage): PersistedAttempt | null {
  const parsed = readJson(storage, ATTEMPT_STORAGE_KEY) as Partial<PersistedAttempt> | null;
  if (!parsed || !isNonEmptyString(parsed.key) || !isNonEmptyString(parsed.fingerprint)) return null;
  if (parsed.key.length > 200 || parsed.fingerprint.length > 2000) return null;
  return { key: parsed.key, fingerprint: parsed.fingerprint };
}

export function storeAttempt(storage: MinimalStorage, attempt: PersistedAttempt): void {
  try {
    storage.setItem(ATTEMPT_STORAGE_KEY, JSON.stringify(attempt));
  } catch {
    // Quota or access denial: the retry simply uses a fresh key (old behavior).
  }
}

export function clearAttempt(storage: MinimalStorage): void {
  try {
    storage.removeItem(ATTEMPT_STORAGE_KEY);
  } catch {
    // Best-effort cleanup only.
  }
}

export function loadSavedRegistration(storage: MinimalStorage): SavedRegistration | null {
  const parsed = readJson(storage, SAVED_STORAGE_KEY) as Partial<SavedRegistration> | null;
  if (!parsed || !isNonEmptyString(parsed.publicId) || !isNonEmptyString(parsed.statusUrl)) return null;
  if (!parsed.statusUrl.startsWith("/registration/status/")) return null;
  if (parsed.publicId.length > 64 || parsed.statusUrl.length > 512) return null;
  return { publicId: parsed.publicId, statusUrl: parsed.statusUrl, savedAt: isNonEmptyString(parsed.savedAt) ? parsed.savedAt : "" };
}

export function saveRegistration(storage: MinimalStorage, registration: SavedRegistration): void {
  try {
    storage.setItem(SAVED_STORAGE_KEY, JSON.stringify(registration));
  } catch {
    // Private-mode denial etc: the user keeps the link from the redirect.
  }
}

export function clearSavedRegistration(storage: MinimalStorage): void {
  try {
    storage.removeItem(SAVED_STORAGE_KEY);
  } catch {
    // Best-effort cleanup only.
  }
}
