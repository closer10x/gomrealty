/**
 * RealtyAPI (realtor.realtyapi.io) server-side client.
 *
 * The key is sent as `x-realtyapi-key` and must never reach the browser, so
 * everything here is server-only and the UI talks to /api/realty/* instead.
 *
 * Spec: https://realtor.realtyapi.io/openapi.json
 */

import "server-only";

export const REALTY_BASE =
  process.env.REALTYAPI_BASE_URL?.replace(/\/+$/, "") ?? "https://realtor.realtyapi.io";

/**
 * Redfin sits on the same RealtyAPI key and auth header but a different host,
 * and carries the neighborhood data the Realtor endpoints don't: schools,
 * flood and climate risk, walk score, and market trends.
 */
export const REDFIN_BASE =
  process.env.REDFIN_API_BASE_URL?.replace(/\/+$/, "") ?? "https://redfin.realtyapi.io";

export const REDFIN_ENDPOINTS = [
  "/autocomplete",
  "/search/bylocation",
  "/search/bycoordinates",
  "/search/bypolygon",
  "/search/byregionid",
  "/search/byurl",
  "/detailsbyid",
  "/detailsbyaddress",
  "/detailsbyurl",
  "/basicDetails",
  "/overview",
  "/mainHouseInfoPanelInfo",
  "/amenities",
  "/insights",
  "/avm",
  "/schools",
  "/climateRisk",
  "/floodInfo",
  "/walkScore",
  "/housingMarketTrends",
  "/usHousingMarketTrends",
  "/marketHotness",
  "/hotMarketInfo",
  "/recentlySold",
  "/priceDropInfo",
  "/popularityInfo",
  "/tourInsights",
  "/mortgageCalculatorInfo",
  "/agentInfo",
] as const;

export type RedfinEndpoint = (typeof REDFIN_ENDPOINTS)[number];

/** Endpoints the proxy is allowed to reach. Anything else is rejected. */
export const REALTY_ENDPOINTS = [
  "/search/bylocation",
  "/search/byzip",
  "/search/bycoordinates",
  "/search/bypolygon",
  "/search/byurl",
  "/details/byid",
  "/details/byaddress",
  "/details/byurl",
  "/autocomplete",
  "/mortgage",
  "/mapLayer",
  "/agent/search",
  "/agent/details",
  "/agent/reviews",
  "/agent/for_sale",
  "/agent/for_rent",
  "/agent/sold",
] as const;

export type RealtyEndpoint = (typeof REALTY_ENDPOINTS)[number];

export class RealtyApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "RealtyApiError";
  }
}

export function realtyConfigured(): boolean {
  return Boolean(process.env.REALTYAPI_KEY);
}

type QueryValue = string | number | boolean | null | undefined;

/**
 * Call a RealtyAPI endpoint. `revalidate` is seconds of ISR cache; listing
 * search is billed per credit, so we cache aggressively by default.
 */
export async function realtyFetch<T = unknown>(
  endpoint: RealtyEndpoint,
  query: Record<string, QueryValue> = {},
  opts: { revalidate?: number; signal?: AbortSignal } = {},
): Promise<T> {
  return providerFetch<T>(REALTY_BASE, endpoint, query, opts);
}

/** Same key and auth header, different host. */
export async function redfinFetch<T = unknown>(
  endpoint: RedfinEndpoint,
  query: Record<string, QueryValue> = {},
  opts: { revalidate?: number; signal?: AbortSignal } = {},
): Promise<T> {
  return providerFetch<T>(REDFIN_BASE, endpoint, query, opts);
}

async function providerFetch<T = unknown>(
  base: string,
  endpoint: string,
  query: Record<string, QueryValue> = {},
  { revalidate = 300, signal }: { revalidate?: number; signal?: AbortSignal } = {},
): Promise<T> {
  const key = process.env.REALTYAPI_KEY;
  if (!key) {
    throw new RealtyApiError("REALTYAPI_KEY is not set", 503);
  }

  const url = new URL(base + endpoint);
  for (const [k, v] of Object.entries(query)) {
    if (v === null || v === undefined || v === "") continue;
    url.searchParams.set(k, String(v));
  }

  const res = await fetch(url, {
    headers: { "x-realtyapi-key": key, accept: "application/json" },
    next: { revalidate },
    signal,
  });

  const text = await res.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* keep raw text */
  }

  if (!res.ok) {
    const detail =
      res.status === 401
        ? "RealtyAPI rejected the key"
        : res.status === 402
          ? "RealtyAPI credits exhausted"
          : `RealtyAPI responded ${res.status}`;
    throw new RealtyApiError(detail, res.status, body);
  }

  return body as T;
}

/** Credits left in the current plan period, surfaced on every response. */
export async function realtyCredits(): Promise<{ limit: number | null; remaining: number | null }> {
  const key = process.env.REALTYAPI_KEY;
  if (!key) return { limit: null, remaining: null };
  const url = new URL(REALTY_BASE + "/autocomplete");
  url.searchParams.set("input", "Houston");
  url.searchParams.set("limit", "1");
  const res = await fetch(url, {
    headers: { "x-realtyapi-key": key },
    next: { revalidate: 3600 },
  });
  const num = (h: string) => {
    const v = res.headers.get(h);
    return v === null ? null : Number(v);
  };
  return { limit: num("x-credits-limit"), remaining: num("x-credits-remaining") };
}

/* ------------------------------------------------------------------ */
/* Credit-saving cache canonicalisation                                */
/* ------------------------------------------------------------------ */

/**
 * RealtyAPI bills one credit per call regardless of result count, and Next's
 * Data Cache keys on the request URL. So the cheapest thing we can do is make
 * near-identical visitor searches produce a byte-identical upstream URL.
 *
 * Verified: upstream matches locations case-insensitively, so folding case is
 * safe and turns "Katy, TX" / "katy, tx" / " Katy,  TX " into one cache entry.
 */

/**
 * Seconds to cache a visitor search. Tuned for the 85k-credit plan: 15 minutes
 * keeps results fresh enough for a listing search while still collapsing the
 * repeat queries and map nudges that dominate real traffic.
 */
export const SEARCH_TTL = 900; // 15m

/**
 * Always ask upstream for this many results and slice locally, so a request
 * for 7 and a request for 12 share one credit instead of costing two.
 */
export const SEARCH_FETCH_COUNT = 24;

/** ~1.4 miles. Small pans land on the same grid point and reuse the cache. */
export const COORD_GRID = 0.02;

const snap = (n: number, grid: number) => Math.round(n / grid) * grid;

export function canonicalLocation(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Snap a viewport to the grid so panning doesn't bill per pixel. */
export function canonicalCoords(lat: number, lng: number, radiusMiles: number) {
  return {
    latitude: Number(snap(lat, COORD_GRID).toFixed(4)),
    longitude: Number(snap(lng, COORD_GRID).toFixed(4)),
    // Whole miles, so a nudge of the zoom doesn't mint a new cache key.
    radius: Math.min(Math.max(Math.round(radiusMiles), 1), 50),
  };
}

/* ------------------------------------------------------------------ */
/* Normalisation                                                       */
/* ------------------------------------------------------------------ */

export type Listing = {
  id: string;
  /** Which upstream this came from. */
  provider?: "realtor" | "redfin";
  /** Redfin needs both ids to resolve a photo via /detailsbyid. */
  propertyId?: string | null;
  listingId?: string | null;
  /** On-site detail page slug, when this listing has one. */
  slug?: string | null;
  price: number | null;
  priceShort: string;
  priceFull: string;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  specs: string;
  address: string;
  city: string | null;
  status: string;
  photo: string | null;
  lat: number | null;
  lng: number | null;
  href: string | null;
};

const pick = (o: Record<string, unknown> | null | undefined, ...keys: string[]): unknown => {
  if (!o) return undefined;
  for (const k of keys) {
    const v = o[k];
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
};

const asNum = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v.replace(/[^0-9.]/g, "")) : Number(v);
  return Number.isFinite(n) ? n : null;
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

/**
 * RealtyAPI mirrors Realtor.com's payload, whose result array has moved around
 * between shapes. Probe the known locations rather than assuming one.
 */
export function extractResults(payload: unknown): Record<string, unknown>[] {
  const paths: string[][] = [
    ["searchResults"],
    ["data", "home_search", "results"],
    ["data", "results"],
    ["home_search", "results"],
    ["properties"],
    ["listings"],
    ["results"],
    ["data"],
  ];
  for (const path of paths) {
    let cur: unknown = payload;
    for (const seg of path) {
      cur = isRecord(cur) ? cur[seg] : undefined;
      if (cur === undefined) break;
    }
    if (Array.isArray(cur)) return cur.filter(isRecord);
  }
  return Array.isArray(payload) ? payload.filter(isRecord) : [];
}

export function formatPriceShort(price: number | null): string {
  if (price === null) return "—";
  if (price >= 1_000_000) {
    const m = price / 1_000_000;
    return `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(2).replace(/0$/, "")}M`;
  }
  if (price >= 1_000) return `$${Math.round(price / 1_000)}K`;
  return `$${price}`;
}

export function formatPriceFull(price: number | null): string {
  return price === null ? "Price on request" : `$${price.toLocaleString("en-US")}`;
}

/**
 * rdcpix serves one photo at several sizes, chosen by a suffix before `.jpg`:
 * `s` is 120x80, `t` 140x105, `m`/`l` ~300px, `x` ~460px, `od` the original
 * (~1024px). Realtor.com listings hand us `od` already, but new-home records on
 * nh.rdcpix.com arrive as `s`, which is far too small for a card and renders
 * visibly blurry. Ask for the original on any rdcpix URL.
 */
export function fullSizePhoto(url: string | null): string | null {
  if (!url || !/^https?:\/\/[^/]*\brdcpix\.com\//.test(url)) return url;
  return url.replace(/(-[a-z]\d+)(?:od|[a-z])?\.jpg$/i, "$1od.jpg");
}

export function normalizeListing(raw: Record<string, unknown>): Listing {
  const desc = isRecord(raw.description) ? raw.description : {};
  const loc = isRecord(raw.location) ? raw.location : {};
  const addr = isRecord(loc.address) ? loc.address : isRecord(raw.address) ? raw.address : {};
  const coord = isRecord(addr.coordinate)
    ? addr.coordinate
    : isRecord(loc.coordinate)
      ? loc.coordinate
      : {};
  // primary_photo / photos[] are plain URL strings here, but the upstream
  // Realtor.com shape wraps them in { href }. Accept either.
  const photoUrl = (v: unknown): string | null => {
    if (typeof v === "string") return v || null;
    if (isRecord(v) && typeof v.href === "string") return v.href;
    return null;
  };
  const photos = Array.isArray(raw.photos) ? raw.photos : [];

  const price =
    asNum(pick(raw, "list_price", "price", "list_price_min")) ??
    asNum(pick(raw, "last_sold_price"));

  const beds = asNum(pick(desc, "beds", "beds_min")) ?? asNum(pick(raw, "beds"));
  const bathsRaw =
    asNum(pick(desc, "baths_consolidated", "baths", "baths_full")) ?? asNum(pick(raw, "baths"));
  const sqft = asNum(pick(desc, "sqft", "sqft_min")) ?? asNum(pick(raw, "sqft"));

  const line = String(pick(addr, "line") ?? "").trim();
  const city = (pick(addr, "city") as string | undefined) ?? null;
  const stateCode = (pick(addr, "state_code", "state") as string | undefined) ?? "";
  const address = [line, city, stateCode].filter(Boolean).join(", ") || "Address withheld";

  const rawStatus = String(pick(raw, "status", "listing_status") ?? "for_sale");
  const status = rawStatus
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();

  const specs = [
    beds !== null ? `${beds} bd` : null,
    bathsRaw !== null ? `${bathsRaw} ba` : null,
    sqft !== null ? `${sqft.toLocaleString("en-US")} sqft` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const permalink = pick(raw, "permalink");
  const propertyId = pick(raw, "property_id");

  const slugBase = [line, city, stateCode].filter(Boolean).join(" ");
  const slug = propertyId
    ? `${slugBase
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 70)}-rc-${propertyId}`
    : null;

  return {
    id: String(pick(raw, "property_id", "listing_id", "id") ?? line ?? Math.random()),
    propertyId: propertyId ? String(propertyId) : null,
    slug,
    price,
    priceShort: formatPriceShort(price),
    priceFull: formatPriceFull(price),
    beds,
    baths: bathsRaw,
    sqft,
    specs: specs || "Details on request",
    address,
    city,
    status: status || "Active",
    photo: fullSizePhoto(photoUrl(raw.primary_photo) ?? photoUrl(photos[0])),
    lat: asNum(pick(coord, "lat", "latitude")) ?? asNum(pick(addr, "latitude")),
    lng: asNum(pick(coord, "lon", "lng", "longitude")) ?? asNum(pick(addr, "longitude")),
    href:
      (typeof raw.href === "string" ? raw.href : null) ??
      (permalink ? `https://www.realtor.com/realestateandhomes-detail/${permalink}` : null),
  };
}

export function normalizeListings(payload: unknown, limit = 24): Listing[] {
  return extractResults(payload)
    .slice(0, limit)
    .map((r) => ({ ...normalizeListing(r), provider: "realtor" as const }));
}

/* ------------------------------------------------------------------ */
/* Redfin                                                              */
/* ------------------------------------------------------------------ */

/**
 * Redfin nests everything under searchResults[].homeData with its own field
 * names, so it needs a separate normalizer rather than the probing one above.
 */
export function normalizeRedfinListing(home: Record<string, unknown>): Listing {
  const addr = isRecord(home.addressInfo) ? home.addressInfo : {};
  const centroidOuter = isRecord(addr.centroid) ? addr.centroid : {};
  const centroid = isRecord(centroidOuter.centroid) ? centroidOuter.centroid : {};
  const priceInfo = isRecord(home.priceInfo) ? home.priceInfo : {};
  const sqftInfo = isRecord(home.sqftInfo) ? home.sqftInfo : {};

  const price = asNum(pick(priceInfo, "amount"));
  const beds = asNum(pick(home, "beds"));
  const baths = asNum(pick(home, "baths"));
  const sqft = asNum(pick(sqftInfo, "amount"));

  const line = String(pick(addr, "formattedStreetLine") ?? "").trim();
  const city = (pick(addr, "city") as string | undefined) ?? null;
  const state = String(pick(addr, "state") ?? "");
  const address = [line, city, state].filter(Boolean).join(", ") || "Address withheld";

  const specs = [
    beds !== null ? `${beds} bd` : null,
    baths !== null ? `${baths} ba` : null,
    sqft !== null ? `${sqft.toLocaleString("en-US")} sqft` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const url = pick(home, "url");

  const propertyId = pick(home, "propertyId");
  const listingId = pick(home, "listingId");

  return {
    id: `rf-${String(propertyId ?? listingId ?? line)}`,
    provider: "redfin",
    propertyId: propertyId ? String(propertyId) : null,
    listingId: listingId ? String(listingId) : null,
    price,
    priceShort: formatPriceShort(price),
    priceFull: formatPriceFull(price),
    beds,
    baths,
    sqft,
    specs: specs || "Details on request",
    address,
    city,
    status: "For Sale",
    // photosInfo exposes only group codes, not URLs. The Redfin CDN path is
    // undocumented, so guessing one would just yield broken images.
    photo: null,
    lat: asNum(pick(centroid, "latitude")),
    lng: asNum(pick(centroid, "longitude")),
    href: typeof url === "string" && url ? `https://www.redfin.com${url}` : null,
  };
}

export function normalizeRedfinListings(payload: unknown, limit = 24): Listing[] {
  const rows = isRecord(payload) && Array.isArray(payload.searchResults) ? payload.searchResults : [];
  return rows
    .filter(isRecord)
    .map((r) => (isRecord(r.homeData) ? r.homeData : null))
    .filter((h): h is Record<string, unknown> => h !== null)
    .slice(0, limit)
    .map(normalizeRedfinListing);
}

/** Street + city, lowercased — stable enough to spot the same home twice. */
function addressKey(l: Listing): string {
  return l.address
    .toLowerCase()
    .replace(/[.,#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Merge provider results round-robin, preferring the earlier list on a
 * collision. Realtor is passed first because it carries photos and Redfin
 * does not, so a duplicate address keeps the entry with an image.
 *
 * Interleaved rather than concatenated: appending then slicing to `limit`
 * lets the first provider fill the whole quota and starves the second
 * entirely.
 */
export function mergeListings(lists: Listing[][], limit: number): Listing[] {
  const seen = new Set<string>();
  const out: Listing[] = [];
  const longest = Math.max(0, ...lists.map((l) => l.length));

  for (let i = 0; i < longest && out.length < limit; i++) {
    for (const list of lists) {
      if (out.length >= limit) break;
      const l = list[i];
      if (!l) continue;
      const k = addressKey(l);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(l);
    }
  }
  return out;
}
