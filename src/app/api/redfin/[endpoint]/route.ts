/**
 * Redfin passthrough: /api/redfin/<endpoint>?<same query as upstream>
 *
 * Nested upstream paths use a dash: /api/redfin/search-bylocation -> /search/bylocation
 * Only endpoints on the allowlist in lib/realty.ts are reachable.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  REDFIN_ENDPOINTS,
  RealtyApiError,
  redfinFetch,
  type RedfinEndpoint,
} from "@/lib/realty";

export const runtime = "nodejs";

function resolveEndpoint(slug: string): RedfinEndpoint | null {
  // Redfin mixes flat camelCase paths with nested ones, so try both readings.
  const nested = "/" + slug.replace(/-/g, "/");
  const flat = "/" + slug;
  const all = REDFIN_ENDPOINTS as readonly string[];
  if (all.includes(nested)) return nested as RedfinEndpoint;
  if (all.includes(flat)) return flat as RedfinEndpoint;
  return null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ endpoint: string }> },
) {
  const { endpoint: slug } = await params;
  const endpoint = resolveEndpoint(slug);

  if (!endpoint) {
    return NextResponse.json(
      { error: `Unknown endpoint "${slug}"`, allowed: REDFIN_ENDPOINTS },
      { status: 404 },
    );
  }

  const query = Object.fromEntries(req.nextUrl.searchParams.entries());

  try {
    const data = await redfinFetch(endpoint, query);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (err) {
    if (err instanceof RealtyApiError) {
      return NextResponse.json({ error: err.message, detail: err.body }, { status: err.status });
    }
    return NextResponse.json({ error: "Upstream request failed" }, { status: 502 });
  }
}
