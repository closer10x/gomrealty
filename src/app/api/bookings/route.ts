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
import { formatDayLong, formatTime, formatZoneAbbr, dayKey, isValidSlot, slotEnd } from "@/lib/booking";
import { sendBookingConfirmation, sendBookingNotification } from "@/lib/email";

export const runtime = "nodejs";

const TOPICS = new Set(["Buying", "Selling", "Both", "Relocating"]);
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
/** Postgres unique_violation — the slot was taken between render and submit. */
const UNIQUE_VIOLATION = "23505";

/**
 * Abuse limits. The calendar is 30 days x 24 slots = 720 bookings, all of them
 * free and unauthenticated, so without a ceiling one script can take the whole
 * thing and the phone stops ringing. Generous enough that a real person
 * rebooking twice never notices.
 */
const MAX_PER_IP_HOUR = 3;
const MAX_PER_EMAIL_DAY = 3;

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
  const ipHash = ip ? createHash("sha256").update(ip).digest("hex").slice(0, 32) : null;
  const startIso = new Date(start!).toISOString();

  // Counted against confirmed rows only, so cancelling frees the allowance.
  const since = (mins: number) => new Date(Date.now() - mins * 60_000).toISOString();

  const [byIp, byEmail] = await Promise.all([
    ipHash
      ? db
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .eq("ip_hash", ipHash)
          .eq("status", "confirmed")
          .gte("created_at", since(60))
      : Promise.resolve({ count: 0, error: null }),
    db
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("email", email!)
      .eq("status", "confirmed")
      .gte("created_at", since(60 * 24)),
  ]);

  const overLimit =
    (byIp.count ?? 0) >= MAX_PER_IP_HOUR || (byEmail.count ?? 0) >= MAX_PER_EMAIL_DAY;

  if (overLimit) {
    console.warn("[bookings] rate limited", { ipHash, email, ip: byIp.count, mail: byEmail.count });
    return NextResponse.json(
      {
        error:
          "You already have calls booked. Give us a ring on 832.514.7301 if you need another time.",
      },
      { status: 429 },
    );
  }

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
    ip_hash: ipHash,
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

  // Pre-formatted in office time so the confirmation screen agrees with the
  // calendar the visitor just used.
  const summary = `${formatDayLong(dayKey(new Date(startIso)))} at ${formatTime(startIso)}`;

  // The row is already committed, so mail is best-effort from here. Both
  // messages go out together and neither can reject the response — a booking
  // that saved is a real booking even if the mail API is having a bad day.
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ?? "";
  const cancelUrl = site ? `${site}/booking/cancel/${data.cancel_token as string}` : null;

  const mail = {
    id: data.id as string,
    cancelUrl,
    start: startIso,
    end: slotEnd(startIso),
    summary,
    zone: formatZoneAbbr(startIso),
    fullName: fullName!,
    email: email!,
    phone: row.phone,
    topic,
    message: row.message,
  };

  const [confirmation, notification] = await Promise.all([
    sendBookingConfirmation(mail),
    sendBookingNotification(mail),
  ]);

  for (const [label, r] of [["confirmation", confirmation], ["notification", notification]] as const) {
    if (r.sent) continue;
    // Skipped means "not configured yet"; error means it was tried and failed,
    // which is the case worth chasing because someone is expecting a call.
    if (r.skipped) console.warn(`[bookings] ${label} email skipped: ${r.skipped}`);
    else console.error(`[bookings] ${label} email FAILED for ${email}: ${r.error}`);
  }

  console.info("[bookings] confirmed", {
    id: data.id,
    startsAt: data.starts_at,
    email,
    confirmationSent: confirmation.sent,
    notificationSent: notification.sent,
  });

  return NextResponse.json({
    ok: true,
    id: data.id,
    start: startIso,
    end: slotEnd(startIso),
    summary,
    // Lets the confirmation screen say "check your email" only when it is true.
    emailed: confirmation.sent,
  });
}
