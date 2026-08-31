/**
 * Lead intake for the contact and valuation forms.
 *
 * Writes with the service-role key so the `leads` table stays closed to the
 * browser. When Supabase is not configured the submission is accepted and
 * logged, so the forms still behave correctly in a fresh checkout.
 */
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

const KINDS = new Set(["contact", "valuation"]);
const INTENTS = new Set(["Buying", "Selling", "Both", "Relocating"]);
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

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
  const kind = KINDS.has(String(body.kind)) ? String(body.kind) : "contact";
  const intent = INTENTS.has(String(body.intent)) ? String(body.intent) : null;

  const errors: Record<string, string> = {};
  if (!fullName) errors.fullName = "Enter your name";
  if (!email) errors.email = "Enter your email";
  else if (!EMAIL.test(email)) errors.email = "That email doesn't look right";

  if (Object.keys(errors).length) {
    return NextResponse.json({ error: "Validation failed", errors }, { status: 422 });
  }

  const forwarded = req.headers.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0]?.trim();

  const row = {
    kind,
    intent,
    full_name: fullName,
    email,
    phone: clean(body.phone, 40),
    property_address: clean(body.propertyAddress, 300),
    message: clean(body.message, 4000),
    source_path: clean(body.sourcePath, 200),
    referrer: clean(req.headers.get("referer"), 300),
    user_agent: clean(req.headers.get("user-agent"), 400),
    ip_hash: ip ? createHash("sha256").update(ip).digest("hex").slice(0, 32) : null,
  };

  const db = supabaseAdmin();
  if (!db) {
    console.warn("[leads] Supabase not configured; submission not persisted:", {
      kind: row.kind,
      email: row.email,
    });
    return NextResponse.json({ ok: true, persisted: false });
  }

  const { error } = await db.from("leads").insert(row);
  if (error) {
    console.error("[leads] insert failed:", error.message);
    return NextResponse.json({ error: "Could not save your message" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, persisted: true });
}
