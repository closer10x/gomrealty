/**
 * Normalised listing search used by the homepage map panel.
 *
 * GET /api/realty/search?location=Katy, TX&searchType=For_Sale&limit=7
 * Falls back to the sample market when REALTYAPI_KEY is absent, so the site
 * renders correctly before the key is provisioned.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  RealtyApiError,
  SEARCH_FETCH_COUNT,
  SEARCH_TTL,
  canonicalLocation,
  mergeListings,
  normalizeListings,
  normalizeRedfinListings,
  realtyConfigured,
  realtyFetch,
  redfinFetch,
} from "@/lib/realty";
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
  const limit = Math.min(Math.max(Number(sp.get("limit") ?? 7) || 7, 1), 200);
  const page = Math.min(Math.max(Number(sp.get("page")) || 1, 1), 40);

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
      page: 1,
      nextPage: false,
    });
  }

  const sortOrder = sp.get("sortOrder");
  const searchType = sp.get("searchType");

  /**
   * Which upstreams to query. Each provider costs one credit per call, so
   * ?providers=realtor halves the spend when Redfin isn't needed.
   */
  const providers = new Set(
    (sp.get("providers") ?? "realtor,redfin").split(",").map((s) => s.trim().toLowerCase()),
  );

  const query: Record<string, string | number> = {
    // Always ask upstream for the same count so requests for different `limit`
    // values share one cached response — and one credit.
    resultCount: Math.max(limit, SEARCH_FETCH_COUNT),
    page,
    sortOrder: sortOrder && SORTS.has(sortOrder) ? sortOrder : "Recommended",
    searchType: searchType && TYPES.has(searchType) ? searchType : "For_Sale",
  };

  for (const k of ["priceRange", "bedsRange", "bathsRange", "sqftRange", "propertyType"]) {
    const v = sp.get(k);
    if (v) query[k] = v;
  }
  if (sp.get("newConstruction") === "true") query.newConstruction = "true";

  try {
    const wantRealtor = providers.has("realtor");
    const wantRedfin = providers.has("redfin");

    const realtorPromise = wantRealtor
      ? byCoords
        ? realtyFetch(
            "/search/bycoordinates",
            { ...query, latitude: lat, longitude: lng, radius },
            { revalidate: SEARCH_TTL },
          )
        : zip
          ? realtyFetch("/search/byzip", { ...query, zipCode: zip }, { revalidate: SEARCH_TTL })
          : realtyFetch(
              "/search/bylocation",
              { ...query, location: canonicalLocation(location) },
              { revalidate: SEARCH_TTL },
            )
      : Promise.reject(new Error("skipped"));

    // Redfin uses its own parameter names for the same concepts.
    const redfinPromise = wantRedfin
      ? byCoords
        ? redfinFetch(
            "/search/bycoordinates",
            {
              latitude: lat,
              longitude: lng,
              radius,
              resultCount: Math.max(limit, SEARCH_FETCH_COUNT),
              page,
              searchType: query.searchType,
            },
            { revalidate: SEARCH_TTL },
          )
        : redfinFetch(
            "/search/bylocation",
            {
              locationName: zip ?? canonicalLocation(location),
              resultCount: Math.max(limit, SEARCH_FETCH_COUNT),
              page,
              searchType: query.searchType,
            },
            { revalidate: SEARCH_TTL },
          )
      : Promise.reject(new Error("skipped"));

    const [realtorRes, redfinRes] = await Promise.allSettled([realtorPromise, redfinPromise]);

    const payload = realtorRes.status === "fulfilled" ? realtorRes.value : null;
    const realtorListings = payload ? normalizeListings(payload, limit) : [];
    const redfinListings =
      redfinRes.status === "fulfilled" ? normalizeRedfinListings(redfinRes.value, limit) : [];

    // Realtor first: it carries photos, Redfin doesn't, so on a duplicate
    // address the entry with an image wins.
    const listings = mergeListings([realtorListings, redfinListings], limit);
    const live = listings.length > 0;
    const nextPageOf = (v: unknown) =>
      Boolean(v && typeof v === "object" && (v as { nextPage?: boolean }).nextPage);
    const nextPage =
      nextPageOf(payload) ||
      (redfinRes.status === "fulfilled" && nextPageOf(redfinRes.value));
    return NextResponse.json(
      {
        source: live ? "realtyapi" : "sample",
        ...(live ? {} : { note: "Upstream returned no parsable listings." }),
        location: byCoords ? `${lat.toFixed(4)},${lng.toFixed(4)}` : (zip ?? location),
        page,
        nextPage,
        providers: {
          realtor: realtorListings.length,
          redfin: redfinListings.length,
        },
        listings: live ? listings : SAMPLE_LISTINGS.slice(0, limit),
      },
      {
        // Match the upstream TTL so the CDN absorbs repeat searches instead of
        // waking the function and spending credits again.
        headers: {
          "Cache-Control": `public, s-maxage=${SEARCH_TTL}, stale-while-revalidate=86400`,
        },
      },
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
