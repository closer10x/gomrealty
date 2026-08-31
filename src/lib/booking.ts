/**
 * Booking rules and slot arithmetic for the intro-call scheduler.
 *
 * Shared by the API routes and the calendar component, so everything here is
 * pure and dependency-free — no `server-only`, no Date.now() baked into module
 * scope. Slots are computed in OFFICE_TZ and handed around as UTC instants;
 * only formatting ever converts back.
 */

/** Everything the office schedule is expressed in. */
export const OFFICE_TZ = "America/Chicago";

/** Length of one call, and the grid the day is divided into. */
export const SLOT_MINUTES = 30;

/**
 * Local opening hours, [openHour, closeHour) in 24h office time, keyed by
 * getUTCDay(). Matches the hours the site publishes (SITE.hours) — seven days,
 * 8am to 8pm. Narrow a day by editing its pair; close one with `null`.
 */
export const OFFICE_HOURS: Record<number, [number, number] | null> = {
  0: [8, 20], // Sun
  1: [8, 20],
  2: [8, 20],
  3: [8, 20],
  4: [8, 20],
  5: [8, 20],
  6: [8, 20], // Sat
};

/** No same-minute bookings — the agent needs a moment's warning. */
export const MIN_LEAD_MINUTES = 120;

/** How far out the calendar opens. */
export const HORIZON_DAYS = 30;

export type Slot = { start: string; end: string; available: boolean };

/* ------------------------------------------------------------------ */
/* Timezone arithmetic                                                 */
/* ------------------------------------------------------------------ */

const partsInTz = (date: Date, tz: string) => {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    // Intl can emit "24" for midnight under hour12:false.
    hour: Number(p.hour) % 24,
    minute: Number(p.minute),
    second: Number(p.second),
  };
};

/** Milliseconds that `tz` is ahead of UTC at the given instant. */
function tzOffsetMs(date: Date, tz: string): number {
  const p = partsInTz(date, tz);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - date.getTime();
}

/**
 * The instant at which the given wall-clock time occurs in `tz`.
 *
 * Applied twice because the offset itself depends on the instant: the first
 * pass lands close enough that the second reads the correct DST side.
 */
export function zonedToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  tz: string = OFFICE_TZ,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const first = tzOffsetMs(new Date(guess), tz);
  const second = tzOffsetMs(new Date(guess - first), tz);
  return new Date(guess - second);
}

/** "YYYY-MM-DD" for an instant, as seen in `tz`. */
export function dayKey(date: Date, tz: string = OFFICE_TZ): string {
  const p = partsInTz(date, tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Parses "YYYY-MM-DD" without letting the local zone shift the date. */
export function parseDayKey(key: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  // Reject dates that rolled over, e.g. 2026-02-31.
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;
  return { year, month, day };
}

/** Day of week for a calendar date, independent of any timezone. */
export function weekdayOf(key: string): number | null {
  const p = parseDayKey(key);
  if (!p) return null;
  return new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
}

/** Shifts a "YYYY-MM-DD" by whole days. */
export function addDays(key: string, days: number): string {
  const p = parseDayKey(key);
  if (!p) return key;
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* Slot generation                                                     */
/* ------------------------------------------------------------------ */

/** Is this date inside the bookable window at all? Ignores taken slots. */
export function isOpenDay(key: string, now: Date = new Date()): boolean {
  const weekday = weekdayOf(key);
  if (weekday === null || OFFICE_HOURS[weekday] === null) return false;

  const today = dayKey(now);
  return key >= today && key <= addDays(today, HORIZON_DAYS);
}

/**
 * Every slot the office grid defines for a date, already filtered for the
 * lead time and the booking horizon. Does not consult the database — callers
 * mark the taken ones.
 */
export function slotsForDay(key: string, now: Date = new Date()): string[] {
  const p = parseDayKey(key);
  const weekday = weekdayOf(key);
  if (!p || weekday === null) return [];

  const hours = OFFICE_HOURS[weekday];
  if (!hours) return [];
  if (!isOpenDay(key, now)) return [];

  const earliest = now.getTime() + MIN_LEAD_MINUTES * 60_000;
  const [open, close] = hours;
  const out: string[] = [];

  for (let minutes = open * 60; minutes + SLOT_MINUTES <= close * 60; minutes += SLOT_MINUTES) {
    const start = zonedToUtc(p.year, p.month, p.day, Math.floor(minutes / 60), minutes % 60);
    if (start.getTime() >= earliest) out.push(start.toISOString());
  }
  return out;
}

/** The end instant of a slot that starts at `startIso`. */
export function slotEnd(startIso: string): string {
  return new Date(new Date(startIso).getTime() + SLOT_MINUTES * 60_000).toISOString();
}

/** Is this exact instant a real slot on the grid for its own day? */
export function isValidSlot(startIso: string, now: Date = new Date()): boolean {
  const d = new Date(startIso);
  if (Number.isNaN(d.getTime())) return false;
  return slotsForDay(dayKey(d), now).includes(d.toISOString());
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

export function formatTime(iso: string, tz: string = OFFICE_TZ): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatDayLong(key: string): string {
  const p = parseDayKey(key);
  if (!p) return key;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(Date.UTC(p.year, p.month - 1, p.day)));
}

export function formatZoneAbbr(iso: string, tz: string = OFFICE_TZ): string {
  const part = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" })
    .formatToParts(new Date(iso))
    .find((p) => p.type === "timeZoneName");
  return part?.value ?? "";
}
