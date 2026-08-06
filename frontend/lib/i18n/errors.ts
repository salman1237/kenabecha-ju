import { ApiError } from "@/lib/api/client";
import type { Translations } from "@/messages/en";

/**
 * Turns whatever `apiFetch` threw into a message in the user's language.
 *
 * Falls through in three steps, so nothing ever renders blank:
 *   1. a known `code` → the translated string
 *   2. an unknown code, or none at all → the server's own English `detail`,
 *      which is still more specific than a generic apology
 *   3. a non-API failure (offline, DNS, CORS) → the translated network error
 */
export function translateApiError(error: unknown, t: Translations): string {
  if (error instanceof ApiError) {
    if (error.code && error.code in t.errors) {
      return t.errors[error.code as keyof Translations["errors"]];
    }
    if (error.message) return error.message;
    return t.errors.generic;
  }
  if (error instanceof TypeError) return t.errors.network;
  return t.errors.generic;
}
