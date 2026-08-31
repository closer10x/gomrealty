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
  { revalidate = 300, signal }: { revalidate?: number; signal?: AbortSignal } = {},
): Promise<T> {
  const key = process.env.REALTYAPI_KEY;
  if (!key) {
    throw new RealtyApiError("REALTYAPI_KEY is not set", 503);
  }

  const url = new URL(REALTY_BASE + endpoint);
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
/* Normalisation                                                       */
/* ------------------------------------------------------------------ */

export type Listing = {
  id: string;
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

export function normalizeListing(raw: Record<string, unknown>): Listing {
  const desc = isRecord(raw.description) ? raw.description : {};
  const loc = isRecord(raw.location) ? raw.location : {};
  const addr = isRecord(loc.address) ? loc.address : isRecord(raw.address) ? raw.address : {};
  const coord = isRecord(addr.coordinate)
    ? addr.coordinate
    : isRecord(loc.coordinate)
      ? loc.coordinate
      : {};
  const primaryPhoto = isRecord(raw.primary_photo) ? raw.primary_photo : {};
  const photos = Array.isArray(raw.photos) ? raw.photos : [];
  const firstPhoto = isRecord(photos[0]) ? photos[0] : {};

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

  return {
    id: String(pick(raw, "property_id", "listing_id", "id") ?? line ?? Math.random()),
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
    photo:
      (pick(primaryPhoto, "href") as string | undefined) ??
      (pick(firstPhoto, "href") as string | undefined) ??
      null,
    lat: asNum(pick(coord, "lat", "latitude")),
    lng: asNum(pick(coord, "lon", "lng", "longitude")),
    href: permalink ? `https://www.realtor.com/realestateandhomes-detail/${permalink}` : null,
  };
}

export function normalizeListings(payload: unknown, limit = 24): Listing[] {
  return extractResults(payload).slice(0, limit).map(normalizeListing);
}
