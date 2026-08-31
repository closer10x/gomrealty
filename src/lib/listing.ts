import "server-only";
import { RealtyApiError, realtyConfigured, realtyFetch } from "./realty";

/**
 * Listing detail, normalised into one shape regardless of which upstream it
 * came from. The page renders this and nothing else, so swapping the source
 * later — an IDX feed, say — means writing another loader, not a new page.
 */

export type Provider = "realtor" | "redfin";

export type School = {
  name: string;
  district: string | null;
  grades: string;
  rating: number | null;
  distanceMiles: number | null;
  level: string | null;
};

export type HistoryEvent = {
  date: string;
  label: string;
  price: number | null;
  change: number | null;
};

export type Flood = {
  score: number | null;
  femaZone: string | null;
  trend: string | null;
  insurance: string | null;
  sourceUrl: string | null;
};

export type ListingDetail = {
  provider: Provider;
  propertyId: string;
  listingId: string | null;
  slug: string;

  price: number | null;
  pricePerSqft: number | null;
  status: string;
  listedOn: string | null;

  line: string;
  city: string | null;
  state: string | null;
  postal: string | null;
  lat: number | null;
  lng: number | null;

  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lotSqft: number | null;
  yearBuilt: number | null;
  stories: number | null;
  garage: number | null;
  propertyType: string | null;
  hoaFee: number | null;

  description: string | null;
  photos: string[];
  schools: School[];
  history: HistoryEvent[];
  flood: Flood | null;

  /** Link back to the upstream listing, kept for attribution. */
  sourceUrl: string | null;
  mls: string | null;
};

/* ------------------------------------------------------------------ */
/* Slugs                                                               */
/* ------------------------------------------------------------------ */

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);

/**
 * `<address>-rc-<propertyId>` for Realtor, `<address>-rf-<propertyId>-<listingId>`
 * for Redfin, which needs both ids to look anything up. The address part is for
 * humans and search engines; only the trailing code is parsed.
 */
export function listingSlug(o: {
  provider?: Provider;
  propertyId?: string | null;
  listingId?: string | null;
  address?: string;
  line?: string;
  city?: string | null;
  state?: string | null;
}): string | null {
  const provider = o.provider ?? "realtor";
  const pid = o.propertyId;
  if (!pid) return null;

  const human = slugify(o.address ?? [o.line, o.city, o.state].filter(Boolean).join(" "));
  const code =
    provider === "redfin" ? `rf-${pid}${o.listingId ? `-${o.listingId}` : ""}` : `rc-${pid}`;
  return human ? `${human}-${code}` : code;
}

export function parseListingSlug(
  slug: string,
): { provider: Provider; propertyId: string; listingId: string | null } | null {
  const rf = /-?rf-(\d+)(?:-(\d+))?$/.exec(slug);
  if (rf) return { provider: "redfin", propertyId: rf[1], listingId: rf[2] ?? null };

  const rc = /-?rc-(\d+)$/.exec(slug);
  if (rc) return { provider: "realtor", propertyId: rc[1], listingId: null };

  return null;
}

/* ------------------------------------------------------------------ */
/* Loading                                                             */
/* ------------------------------------------------------------------ */

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v.replace(/[^0-9.\-]/g, "")) : Number(v);
  return Number.isFinite(n) ? n : null;
};

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

/** Strips the HTML that Realtor embeds in its flood copy. */
const stripTags = (v: string | null): string | null =>
  v ? v.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() || null : null;

/** Prices per week; the rest of the payload changes rarely. */
const DETAIL_TTL = 86_400;

async function loadRealtor(propertyId: string): Promise<ListingDetail | null> {
  const payload = await realtyFetch<{ detail?: Record<string, unknown> }>(
    "/details/byid",
    { property_id: propertyId },
    { revalidate: DETAIL_TTL },
  );

  const d = isRec(payload?.detail) ? payload.detail : null;
  if (!d) return null;

  const det = isRec(d.details) ? d.details : {};
  const addr = isRec(d.address) ? d.address : {};
  const local = isRec(d.local) ? d.local : {};
  const fl = isRec(local.flood) ? local.flood : null;
  const mls = isRec(d.mls) ? d.mls : {};

  const line = str(addr.line) ?? "Address withheld";
  const city = str(addr.city);
  const state = str(addr.state_code) ?? str(addr.state);

  const photos = (Array.isArray(d.photos) ? d.photos : [])
    .map((p) => (isRec(p) ? str(p.href) : str(p)))
    .filter((h): h is string => Boolean(h));

  const schools: School[] = (Array.isArray(d.schools) ? d.schools : [])
    .filter(isRec)
    .map((s) => ({
      name: str(s.name) ?? "—",
      district: str(s.district),
      grades: Array.isArray(s.grades) ? s.grades.filter(Boolean).join(", ") : "",
      rating: num(s.rating),
      distanceMiles: num(s.distance_in_miles),
      level: Array.isArray(s.education_levels) ? (str(s.education_levels[0]) ?? null) : null,
    }))
    .filter((s) => s.name !== "—");

  const history: HistoryEvent[] = (Array.isArray(d.property_history) ? d.property_history : [])
    .filter(isRec)
    .map((h) => ({
      date: str(h.date) ?? "",
      label: str(h.event_name) ?? "Updated",
      price: num(h.price),
      change: num(h.price_change),
    }))
    .filter((h) => h.date);

  const listingId = str(d.listing_id);

  return {
    provider: "realtor",
    propertyId,
    listingId,
    slug:
      listingSlug({ provider: "realtor", propertyId, line, city, state }) ?? `rc-${propertyId}`,

    price: num(d.list_price),
    pricePerSqft: num(d.price_per_sqft),
    status: (str(d.status) ?? "for_sale").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    listedOn: str(d.list_date),

    line,
    city,
    state,
    postal: str(addr.postal_code),
    lat: num(addr.latitude),
    lng: num(addr.longitude),

    beds: num(det.beds),
    baths: num(det.baths),
    sqft: num(det.sqft),
    lotSqft: num(det.lot_sqft),
    yearBuilt: num(det.year_built),
    stories: num(det.stories),
    garage: num(det.garage),
    propertyType: str(det.type)?.replace(/_/g, " ") ?? null,
    hoaFee: num(isRec(d.hoa_fee) ? d.hoa_fee.fee : d.hoa_fee),

    description: str(det.text),
    photos,
    schools,
    history,
    flood: fl
      ? {
          score: num(fl.flood_factor_score),
          femaZone: Array.isArray(fl.fema_zone) ? (str(fl.fema_zone[0]) ?? null) : str(fl.fema_zone),
          trend: stripTags(str(fl.flood_trend_paragraph)),
          insurance: stripTags(str(fl.flood_insurance_text)),
          sourceUrl: str(fl.firststreet_url),
        }
      : null,

    sourceUrl: str(d.href),
    mls: str(mls.id) ?? str(mls.abbreviation),
  };
}

/**
 * Redfin deliberately has no detail loader.
 *
 * Its /detailsbyid payload carries galleries but no address, price, beds or
 * baths — a detail page built from it would be photographs with no facts. Its
 * search rows do have those fields, but pairing them would mean trusting a
 * fuzzy address match to decide what a house costs.
 *
 * So Redfin listings keep their outbound link and Realtor listings get on-site
 * pages, where one call returns the whole record. Revisit if RealtyAPI exposes
 * a Redfin detail endpoint that includes the basics.
 */

/**
 * Loads one listing. Returns null when the slug is unparseable or the upstream
 * has nothing, which the page turns into a 404.
 */
export async function getListing(slug: string): Promise<ListingDetail | null> {
  if (!realtyConfigured()) return null;
  const parsed = parseListingSlug(slug);
  if (!parsed) return null;

  // See the note above: only Realtor listings have a complete enough record.
  if (parsed.provider === "redfin") return null;

  try {
    return await loadRealtor(parsed.propertyId);
  } catch (err) {
    if (err instanceof RealtyApiError) {
      console.warn(`[listing] ${parsed.provider} ${parsed.propertyId}: ${err.message}`);
      return null;
    }
    throw err;
  }
}
