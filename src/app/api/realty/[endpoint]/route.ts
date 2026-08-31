/**
 * Generic RealtyAPI passthrough: /api/realty/<endpoint>?<same query as upstream>
 *
 * Nested upstream paths use a dash: /api/realty/agent-for_sale -> /agent/for_sale
 * Only endpoints on the allowlist in lib/realty.ts are reachable.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  REALTY_ENDPOINTS,
  RealtyApiError,
  realtyFetch,
  type RealtyEndpoint,
} from "@/lib/realty";

export const runtime = "nodejs";

function resolveEndpoint(slug: string): RealtyEndpoint | null {
  const candidate = "/" + slug.replace(/-/g, "/");
  return (REALTY_ENDPOINTS as readonly string[]).includes(candidate)
    ? (candidate as RealtyEndpoint)
    : null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ endpoint: string }> },
) {
  const { endpoint: slug } = await params;
  const endpoint = resolveEndpoint(slug);

  if (!endpoint) {
    return NextResponse.json(
      { error: `Unknown endpoint "${slug}"`, allowed: REALTY_ENDPOINTS },
      { status: 404 },
    );
  }

  const query = Object.fromEntries(req.nextUrl.searchParams.entries());

  try {
    const data = await realtyFetch(endpoint, query);
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
