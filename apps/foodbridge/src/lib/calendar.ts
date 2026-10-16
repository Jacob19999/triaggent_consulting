// Working days: Monday–Friday less six closure holidays, the calendar the Q7 model
// uses (CLAUDE.md "Calendar (Q7)"). It is known in advance and is not outcome data.

function nthWeekday(year: number, month: number, weekday: number, n: number): number {
  const first = new Date(Date.UTC(year, month, 1)).getUTCDay();
  return 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
}

function lastWeekday(year: number, month: number, weekday: number): number {
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const last = new Date(Date.UTC(year, month, days)).getUTCDay();
  return days - ((last - weekday + 7) % 7);
}

/** Observed closure dates (weekend holidays shift to Friday/Monday). */
function holidays(year: number): Set<string> {
  const out = new Set<string>();
  const add = (m: number, d: number) => {
    const date = new Date(Date.UTC(year, m, d));
    const dow = date.getUTCDay();
    if (dow === 6) date.setUTCDate(d - 1);
    if (dow === 0) date.setUTCDate(d + 1);
    out.add(date.toISOString().slice(0, 10));
  };
  add(0, 1); // New Year's Day
  add(4, lastWeekday(year, 4, 1)); // Memorial Day
  add(6, 4); // Independence Day
  add(8, nthWeekday(year, 8, 1, 1)); // Labor Day
  add(10, nthWeekday(year, 10, 4, 4)); // Thanksgiving
  add(11, 25); // Christmas
  return out;
}

/** Working days in a YYYY-MM month. */
export function workdays(month: string): number {
  const [y, m] = month.split("-").map(Number);
  const closed = holidays(y);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  let count = 0;
  for (let d = 1; d <= days; d++) {
    const date = new Date(Date.UTC(y, m - 1, d));
    const dow = date.getUTCDay();
    if (dow !== 0 && dow !== 6 && !closed.has(date.toISOString().slice(0, 10))) count++;
  }
  return count;
}

/** Each day of a YYYY-MM month with its weekday (0 = Sunday) and whether it is a working day. */
export function monthDays(month: string): { day: number; dow: number; work: boolean }[] {
  const [y, m] = month.split("-").map(Number);
  const closed = holidays(y);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(Date.UTC(y, m - 1, i + 1));
    const dow = date.getUTCDay();
    return { day: i + 1, dow, work: dow !== 0 && dow !== 6 && !closed.has(date.toISOString().slice(0, 10)) };
  });
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + n, 1));
  return date.toISOString().slice(0, 7);
}

export function monthRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let m = from; m <= to; m = addMonths(m, 1)) out.push(m);
  return out;
}

export function monthLabel(month: string, style: "short" | "long" = "short"): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: style === "short" ? "short" : "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Last fully elapsed calendar month for a given date (production "as of"). */
export function lastFullMonth(date = new Date()): string {
  return addMonths(date.toISOString().slice(0, 7), -1);
}
