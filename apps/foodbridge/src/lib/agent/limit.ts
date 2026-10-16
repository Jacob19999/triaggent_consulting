import "server-only";

// Per-instance limiter shared by every Gemini route: enough for a demo deployment. For
// durable limits across instances, back this with Upstash Redis or Vercel KV (see README).
const hits = new Map<string, number[]>();
let daily = { day: "", count: 0 };

/** Returns a user-facing reason when this caller or the deployment is over its limit. */
export function limited(ip: string): string | null {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60 * 1000);
  if (recent.length >= Number(process.env.FOODBRIDGE_AI_PER_IP ?? 8)) return "Too many requests. Try again in a few minutes.";
  const today = new Date().toISOString().slice(0, 10);
  if (daily.day !== today) daily = { day: today, count: 0 };
  if (daily.count >= Number(process.env.FOODBRIDGE_AI_DAILY_LIMIT ?? 300)) return "The daily AI limit for this deployment is reached.";
  recent.push(now);
  hits.set(ip, recent);
  daily.count++;
  return null;
}

export const clientIp = (headers: Headers) => headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
