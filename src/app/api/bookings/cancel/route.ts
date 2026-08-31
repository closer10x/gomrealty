/**
 * Cancels a booking by its one-time token.
 *
 * POST /api/bookings/cancel  { token }
 *
 * The token is the only credential — it is a uuid generated per booking and
 * only ever sent to the address that made it, so knowing it is proof enough.
 * Cancelling flips status to 'cancelled', which drops the row out of the
 * partial unique index and frees the slot for someone else.
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { dayKey, formatDayLong, formatTime, formatZoneAbbr } from "@/lib/booking";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!UUID.test(token)) {
    return NextResponse.json({ error: "That cancellation link isn't valid." }, { status: 400 });
  }

  const db = supabaseAdmin();
  if (!db) {
    return NextResponse.json({ error: "Cancellation is temporarily unavailable." }, { status: 503 });
  }

  const { data: existing, error: readErr } = await db
    .from("bookings")
    .select("id, starts_at, status")
    .eq("cancel_token", token)
    .maybeSingle();

  if (readErr) {
    console.error("[cancel] lookup failed:", readErr.message);
    return NextResponse.json({ error: "Could not cancel that call." }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "That cancellation link isn't valid." }, { status: 404 });
  }

  const startIso = new Date(existing.starts_at as string).toISOString();
  const summary = `${formatDayLong(dayKey(new Date(startIso)))} at ${formatTime(startIso)} ${formatZoneAbbr(startIso)}`;

  // Already cancelled is a success, not an error — people click the link twice.
  if (existing.status === "cancelled") {
    return NextResponse.json({ ok: true, alreadyCancelled: true, summary });
  }

  const { error } = await db
    .from("bookings")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("cancel_token", token);

  if (error) {
    console.error("[cancel] update failed:", error.message);
    return NextResponse.json({ error: "Could not cancel that call." }, { status: 500 });
  }

  console.info("[cancel] booking cancelled", { id: existing.id, startsAt: startIso });
  return NextResponse.json({ ok: true, summary });
}
