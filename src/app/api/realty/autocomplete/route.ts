import { NextRequest, NextResponse } from "next/server";
import { RealtyApiError, realtyConfigured, realtyFetch } from "@/lib/realty";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const input = req.nextUrl.searchParams.get("input")?.trim();
  if (!input) return NextResponse.json({ suggestions: [] });
  if (!realtyConfigured()) return NextResponse.json({ suggestions: [] });

  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 8) || 8, 20);

  try {
    const data = await realtyFetch("/autocomplete", { input, limit }, { revalidate: 3600 });
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch (err) {
    const status = err instanceof RealtyApiError ? err.status : 502;
    return NextResponse.json({ suggestions: [], error: true }, { status: status >= 500 ? 502 : 200 });
  }
}
