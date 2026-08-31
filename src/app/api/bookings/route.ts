/**
 * Books an intro call.
 *
 * Writes with the service-role key so `bookings` stays closed to the browser,
 * matching /api/leads. Unlike leads, this route cannot succeed without a
 * database: a confirmation we did not persist is a call the agent will miss,
 * so an unconfigured Supabase is a 503 rather than a cheerful no-op.
 */
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/server";
import { formatDayLong, formatTime, dayKey, isValidSlot, slotEnd } from "@/lib/booking";

export const runtime = "nodejs";

const TOPICS = new Set(["Buying", "Selling", "Both", "Relocating"]);
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
/** Postgres unique_violation — the slot was taken between render and submit. */
const UNIQUE_VIOLATION = "23505";

const clean = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Honeypot: real users never fill a hidden field.
  if (clean(body.company, 100)) {
    return NextResponse.json({ ok: true });
  }

  const fullName = clean(body.fullName, 120);
  const email = clean(body.email, 200);
  const start = clean(body.start, 40);
  const topic = TOPICS.has(String(body.topic)) ? String(body.topic) : null;

  const errors: Record<string, string> = {};
  if (!fullName) errors.fullName = "Enter your name";
  if (!email) errors.email = "Enter your email";
  else if (!EMAIL.test(email)) errors.email = "That email doesn't look right";
  if (!start) errors.start = "Pick a time";

  if (Object.keys(errors).length) {
    return NextResponse.json({ error: "Validation failed", errors }, { status: 422 });
  }

  // Re-derive the slot server-side. The client is free to post any instant it
  // likes; only ones on the office grid, inside the horizon and past the lead
  // time are real.
  if (!isValidSlot(start!)) {
    return NextResponse.json(
      { error: "That time isn't available any more. Pick another." },
      { status: 409 },
    );
  }

  const db = supabaseAdmin();
  if (!db) {
    console.error("[bookings] Supabase not configured; refusing to confirm a call.");
    return NextResponse.json(
      { error: "Booking is temporarily unavailable. Please call us instead." },
      { status: 503 },
    );
  }

  const forwarded = req.headers.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0]?.trim();
  const startIso = new Date(start!).toISOString();

  const row = {
    starts_at: startIso,
    ends_at: slotEnd(startIso),
    topic,
    full_name: fullName,
    email,
    phone: clean(body.phone, 40),
    message: clean(body.message, 4000),
    visitor_tz: clean(body.visitorTz, 64),
    source_path: clean(body.sourcePath, 200),
    referrer: clean(req.headers.get("referer"), 300),
    user_agent: clean(req.headers.get("user-agent"), 400),
    ip_hash: ip ? createHash("sha256").update(ip).digest("hex").slice(0, 32) : null,
  };

  const { data, error } = await db
    .from("bookings")
    .insert(row)
    .select("id, starts_at, cancel_token")
    .single();

  if (error) {
    // The unique index is the source of truth for double-booking, not a
    // read-then-write check, so two simultaneous submits resolve correctly.
    if (error.code === UNIQUE_VIOLATION) {
      return NextResponse.json(
        { error: "Someone just took that slot. Pick another time." },
        { status: 409 },
      );
    }
    console.error("[bookings] insert failed:", error.message);
    return NextResponse.json({ error: "Could not book that call" }, { status: 500 });
  }

  console.info("[bookings] confirmed", {
    id: data.id,
    startsAt: data.starts_at,
    email,
  });

  return NextResponse.json({
    ok: true,
    id: data.id,
    start: startIso,
    end: slotEnd(startIso),
    // Pre-formatted in office time so the confirmation screen agrees with the
    // calendar the visitor just used.
    summary: `${formatDayLong(dayKey(new Date(startIso)))} at ${formatTime(startIso)}`,
  });
}
