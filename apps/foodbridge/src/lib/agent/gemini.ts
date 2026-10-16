import "server-only";
import type { GenerateContent, GeminiResponse } from "./run";

export const DEFAULT_AI_MODEL = "gemini-flash-latest";
export const FALLBACK_AI_MODEL = "gemini-3.5-flash-lite";

export class GeminiAPIError extends Error {
  constructor(public readonly status: number, public readonly code: string) {
    // Never retain the raw provider body: it may echo credentials or input.
    super(`Gemini request failed (${status})`);
    this.name = "GeminiAPIError";
  }
}

/** Direct Google REST API; the API key is sent only as a server-side header.
 * One deadline covers the entire tool loop, within the route's 120-second limit.
 */
export function createGeminiClient(apiKey: string, model: string, fetcher: typeof fetch = fetch, deadline = Date.now() + 95_000): GenerateContent {
  if (!/^gemini-[a-zA-Z0-9._-]+$/.test(model)) throw new GeminiAPIError(400, "INVALID_MODEL");
  return async (params) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new GeminiAPIError(504, "TIMEOUT");
    const response = await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-goog-api-key": apiKey },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(Math.min(40_000, remaining)),
      cache: "no-store",
    });
    if (!response.ok) {
      // Status distinguishes quota, overload and configuration failures.
      throw new GeminiAPIError(response.status, response.status === 429 ? "QUOTA" : "UPSTREAM");
    }
    return await response.json() as GeminiResponse;
  };
}
