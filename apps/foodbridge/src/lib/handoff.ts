// Phone/tablet handoff: on a laptop or desktop, the first page of a session shows a QR code
// of that page so people in the room can open it on their own device. Pure helpers here;
// the card is src/components/QrHandoff.tsx.

export const HANDOFF_SEEN_KEY = "fb_qr_handoff_seen";
/** Blank modules around the code; scanners need a light border of four. */
export const QR_QUIET_ZONE = 4;

type DeviceWindow = { navigator: Pick<Navigator, "userAgent" | "maxTouchPoints">; matchMedia: (query: string) => { matches: boolean } };

/** Laptop or desktop: a fine pointer that can hover on a wide screen, and no phone or tablet user agent. */
export function isLaptopLike(w: DeviceWindow): boolean {
  const ua = w.navigator.userAgent;
  if (/Android|iPhone|iPad|iPod|Mobile|Tablet|Silk|Kindle/i.test(ua)) return false;
  // iPadOS asks for desktop pages with a Mac user agent; a real Mac reports no touch points.
  if (/Macintosh/.test(ua) && w.navigator.maxTouchPoints > 1) return false;
  return w.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 1024px)").matches;
}

/** True once per browser session: the first page opened shows the card, later pages do not. */
export function firstEntry(storage: Pick<Storage, "getItem" | "setItem"> | null): boolean {
  try {
    if (!storage) return true;
    if (storage.getItem(HANDOFF_SEEN_KEY)) return false;
    storage.setItem(HANDOFF_SEEN_KEY, "1");
    return true;
  } catch {
    return true;
  }
}

/** The page to open on the other device. Query and hash are dropped so a sign-in code in a
 * callback URL can never end up on screen. */
export function handoffUrl(loc: Pick<Location, "origin" | "pathname">): string {
  return `${loc.origin}${loc.pathname}`;
}

interface QrCode {
  addData(data: string): void;
  make(): void;
  getModuleCount(): number;
  isDark(row: number, col: number): boolean;
}
export type QrFactory = (typeNumber: 0, errorCorrectionLevel: "L" | "M" | "Q" | "H") => QrCode;

/** Dark/light modules of the smallest QR code that holds the text (error correction M). */
export function qrMatrix(qrcode: QrFactory, text: string): boolean[][] {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}

/** One SVG path with a unit square per dark module, offset by the quiet zone. */
export function qrPath(modules: boolean[][], quiet = QR_QUIET_ZONE): string {
  let d = "";
  modules.forEach((row, r) =>
    row.forEach((dark, c) => {
      if (dark) d += `M${c + quiet} ${r + quiet}h1v1h-1z`;
    }),
  );
  return d;
}
