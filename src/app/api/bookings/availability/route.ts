/**
 * Free/busy for the booking calendar.
 *
 *   GET /api/bookings/availability?date=YYYY-MM-DD  -> slots for one day
 *   GET /api/bookings/availability?month=YYYY-MM    -> open-slot count per day
 *
 * Only free/busy ever leaves this route. The `bookings` table holds names,
 * emails and phone numbers, so the queries below select `starts_at` and
 * nothing else — availability must never become a customer-list endpoint.
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  HORIZON_DAYS,
  OFFICE_TZ,
  SLOT_MINUTES,
  addDays,
  dayKey,
  isOpenDay,
  parseDayKey,
  slotEnd,
  slotsForDay,
} from "@/lib/booking";

export const runtime = "nodejs";
// Availability changes the moment someone books; never serve it from a cache.
export const dynamic = "force-dynamic";

/** Confirmed start instants within [fromIso, toIso). */
async function takenBetween(fromIso: string, toIso: string): Promise<Set<string> | null> {
  const db = supabaseAdmin();
  if (!db) return null;

  const { data, error } = await db
    .from("bookings")
    .select("starts_at")
    .eq("status", "confirmed")
    .gte("starts_at", fromIso)
    .lt("starts_at", toIso);

  if (error) {
    console.error("[availability] query failed:", error.message);
    return null;
  }
  return new Set((data ?? []).map((r) => new Date(r.starts_at as string).toISOString()));
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const now = new Date();
  const date = params.get("date");
  const month = params.get("month");

  if (date) {
    if (!parseDayKey(date)) {
      return NextResponse.json({ error: "Expected date=YYYY-MM-DD" }, { status: 400 });
    }

    const starts = slotsForDay(date, now);
    const taken = starts.length
      ? await takenBetween(starts[0], slotEnd(starts[starts.length - 1]))
      : new Set<string>();

    return NextResponse.json({
      date,
      timezone: OFFICE_TZ,
      slotMinutes: SLOT_MINUTES,
      // A null set means Supabase is unreachable. Showing every slot as free
      // would invite a booking we cannot honour, so show none and say why.
      degraded: taken === null,
      slots: starts.map((start) => ({
        start,
        end: slotEnd(start),
        available: taken !== null && !taken.has(start),
      })),
    });
  }

  if (month) {
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "Expected month=YYYY-MM" }, { status: 400 });
    }

    const first = `${month}-01`;
    const parsed = parseDayKey(first);
    if (!parsed) return NextResponse.json({ error: "Unknown month" }, { status: 400 });

    const daysInMonth = new Date(Date.UTC(parsed.year, parsed.month, 0)).getUTCDate();
    const keys = Array.from({ length: daysInMonth }, (_, i) => addDays(first, i));

    // One query for the whole month rather than one per day.
    const open = keys.filter((k) => isOpenDay(k, now));
    let taken: Set<string> | null = new Set<string>();
    if (open.length) {
      const all = open.flatMap((k) => slotsForDay(k, now));
      if (all.length) {
        const sorted = [...all].sort();
        taken = await takenBetween(sorted[0], slotEnd(sorted[sorted.length - 1]));
      }
    }

    const days: Record<string, number> = {};
    for (const k of keys) {
      const starts = slotsForDay(k, now);
      days[k] = taken === null ? 0 : starts.filter((s) => !taken.has(s)).length;
    }

    return NextResponse.json({
      month,
      timezone: OFFICE_TZ,
      today: dayKey(now),
      horizonEnd: addDays(dayKey(now), HORIZON_DAYS),
      degraded: taken === null,
      days,
    });
  }

  return NextResponse.json({ error: "Pass date=YYYY-MM-DD or month=YYYY-MM" }, { status: 400 });
}
