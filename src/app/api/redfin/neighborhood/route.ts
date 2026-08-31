/**
 * The "honest read on the neighborhood behind each pin" the homepage promises.
 *
 * GET /api/redfin/neighborhood?location=Katy, TX
 *
 * Fans out across the Redfin endpoints that carry neighborhood signal and
 * returns them under one shape. Each section resolves independently, so one
 * upstream failing degrades that section rather than the whole response —
 * these are billed per credit, so partial data beats a retry storm.
 */
import { NextRequest, NextResponse } from "next/server";
import { RealtyApiError, realtyConfigured, redfinFetch } from "@/lib/realty";

export const runtime = "nodejs";

type Section = "schools" | "climateRisk" | "marketHotness" | "housingMarketTrends";

const SECTIONS: Section[] = ["schools", "climateRisk", "marketHotness", "housingMarketTrends"];

export async function GET(req: NextRequest) {
  const location = req.nextUrl.searchParams.get("location")?.trim();
  if (!location) {
    return NextResponse.json({ error: "`location` is required" }, { status: 400 });
  }
  if (!realtyConfigured()) {
    return NextResponse.json({ error: "REALTYAPI_KEY is not set" }, { status: 503 });
  }

  const requested = (req.nextUrl.searchParams.get("include")?.split(",") ?? SECTIONS)
    .map((s) => s.trim())
    .filter((s): s is Section => (SECTIONS as string[]).includes(s));

  const results = await Promise.allSettled(
    requested.map((s) => redfinFetch(`/${s}`, { location }, { revalidate: 3600 })),
  );

  const data: Record<string, unknown> = {};
  const failed: Record<string, string> = {};

  results.forEach((r, i) => {
    const name = requested[i];
    if (r.status === "fulfilled") {
      data[name] = r.value;
    } else {
      const e: unknown = r.reason;
      failed[name] = e instanceof RealtyApiError ? e.message : "Upstream request failed";
    }
  });

  return NextResponse.json(
    {
      location,
      data,
      ...(Object.keys(failed).length ? { failed } : {}),
    },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
  );
}
