/**
 * Normalised listing search used by the homepage map panel.
 *
 * GET /api/realty/search?location=Katy, TX&searchType=For_Sale&limit=7
 * Falls back to the sample market when REALTYAPI_KEY is absent, so the site
 * renders correctly before the key is provisioned.
 */
import { NextRequest, NextResponse } from "next/server";
import { RealtyApiError, normalizeListings, realtyConfigured, realtyFetch } from "@/lib/realty";
import { SAMPLE_LISTINGS } from "@/lib/sampleListings";

export const runtime = "nodejs";

const SORTS = new Set([
  "Recommended",
  "Newest",
  "Oldest",
  "Price_High_to_Low",
  "Price_Low_to_High",
  "Square_Feet",
]);
const TYPES = new Set(["For_Sale", "For_Rent", "Sold"]);

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const location = sp.get("location")?.trim() || process.env.NEXT_PUBLIC_DEFAULT_LOCATION || "Houston, TX";
  const zip = sp.get("zipCode")?.trim();
  const limit = Math.min(Math.max(Number(sp.get("limit") ?? 7) || 7, 1), 50);

  // Map panning searches by viewport centre + radius rather than by name.
  // Check the params are actually present: Number(null) is 0, which is finite,
  // so testing isFinite alone sends every search to lat 0/lng 0.
  const latRaw = sp.get("latitude");
  const lngRaw = sp.get("longitude");
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  const byCoords =
    latRaw !== null && lngRaw !== null && Number.isFinite(lat) && Number.isFinite(lng);
  const radius = Math.min(Math.max(Number(sp.get("radius")) || 5, 0.5), 50);

  if (!realtyConfigured()) {
    return NextResponse.json({
      source: "sample",
      note: "REALTYAPI_KEY is not set — showing sample inventory.",
      listings: SAMPLE_LISTINGS.slice(0, limit),
    });
  }

  const sortOrder = sp.get("sortOrder");
  const searchType = sp.get("searchType");

  const query: Record<string, string | number> = {
    resultCount: limit,
    sortOrder: sortOrder && SORTS.has(sortOrder) ? sortOrder : "Recommended",
    searchType: searchType && TYPES.has(searchType) ? searchType : "For_Sale",
  };

  for (const k of ["priceRange", "bedsRange", "bathsRange", "sqftRange", "propertyType"]) {
    const v = sp.get(k);
    if (v) query[k] = v;
  }
  if (sp.get("newConstruction") === "true") query.newConstruction = "true";

  try {
    const payload = byCoords
      ? await realtyFetch("/search/bycoordinates", {
          ...query,
          latitude: lat,
          longitude: lng,
          radius,
        })
      : zip
        ? await realtyFetch("/search/byzip", { ...query, zipCode: zip })
        : await realtyFetch("/search/bylocation", { ...query, location });

    const listings = normalizeListings(payload, limit);
    const live = listings.length > 0;
    return NextResponse.json(
      {
        source: live ? "realtyapi" : "sample",
        ...(live ? {} : { note: "Upstream returned no parsable listings." }),
        location: byCoords ? `${lat.toFixed(4)},${lng.toFixed(4)}` : (zip ?? location),
        listings: live ? listings : SAMPLE_LISTINGS.slice(0, limit),
      },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
    );
  } catch (err) {
    const status = err instanceof RealtyApiError ? err.status : 502;
    // A failed upstream should degrade the map, not blank the homepage.
    return NextResponse.json(
      {
        source: "sample",
        note: err instanceof RealtyApiError ? err.message : "Upstream request failed",
        listings: SAMPLE_LISTINGS.slice(0, limit),
      },
      { status: status === 402 || status === 401 ? 200 : 200 },
    );
  }
}
