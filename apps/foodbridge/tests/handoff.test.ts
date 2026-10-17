import qrcode from "qrcode-generator";
import { describe, expect, it } from "vitest";
import { firstEntry, handoffUrl, HANDOFF_SEEN_KEY, isLaptopLike, qrMatrix, qrPath } from "@/lib/handoff";

const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36";
const WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const ANDROID_TABLET = "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36";

const device = (userAgent: string, maxTouchPoints: number, desktopMedia: boolean) => ({
  navigator: { userAgent, maxTouchPoints },
  matchMedia: () => ({ matches: desktopMedia }),
});

describe("QR handoff", () => {
  it("shows only on a laptop or desktop", () => {
    expect(isLaptopLike(device(MAC, 0, true))).toBe(true);
    expect(isLaptopLike(device(WINDOWS, 10, true))).toBe(true); // touch-screen laptop with a mouse
    expect(isLaptopLike(device(IPHONE, 5, true))).toBe(false);
    expect(isLaptopLike(device(ANDROID_TABLET, 10, true))).toBe(false);
    expect(isLaptopLike(device(MAC, 5, true))).toBe(false); // iPadOS asking for the desktop site
    expect(isLaptopLike(device(MAC, 0, false))).toBe(false); // narrow window or no hover pointer
  });

  it("is the first entry once per session and fails open without storage", () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    expect(firstEntry(storage)).toBe(true);
    expect(store.get(HANDOFF_SEEN_KEY)).toBe("1");
    expect(firstEntry(storage)).toBe(false);
    expect(firstEntry(null)).toBe(true);
    const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => undefined };
    expect(firstEntry(blocked)).toBe(true);
  });

  it("encodes the page without its query or hash", () => {
    expect(handoffUrl({ origin: "https://foodbridge.example", pathname: "/manager/fei" })).toBe("https://foodbridge.example/manager/fei");
    const loc = new URL("https://foodbridge.example/auth/callback?code=secret#x");
    expect(handoffUrl(loc)).toBe("https://foodbridge.example/auth/callback");
  });

  it("builds a square module grid and one unit square per dark module", () => {
    const m = qrMatrix(qrcode, "https://foodbridge.example/manager/map");
    const n = m.length;
    expect(n).toBeGreaterThanOrEqual(21);
    expect((n - 17) % 4).toBe(0); // QR versions are 21, 25, 29, … modules wide
    expect(m.every((row) => row.length === n)).toBe(true);
    // Finder patterns: dark corners with a light separator ring.
    for (const [r, c] of [[0, 0], [0, n - 1], [n - 1, 0]]) expect(m[r][c]).toBe(true);
    expect(m[7][7]).toBe(false);
    const d = qrPath(m);
    const dark = m.flat().filter(Boolean).length;
    expect(d.match(/M/g)?.length).toBe(dark);
    expect(d.startsWith("M4 4h1v1h-1z")).toBe(true); // top-left module after the quiet zone
  });
});
