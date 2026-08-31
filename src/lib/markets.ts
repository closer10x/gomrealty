import "server-only";
import { AREAS } from "./content";
import { normalizeListing, realtyConfigured, realtyFetch, extractResults } from "./realty";

export type Market = {
  name: string;
  note: string;
  href: string;
  slot: string;
  /** Live active-listing count. null when unknown — never a placeholder number. */
  count: number | null;
  /** A real listing photo from that market, for the card. */
  photo: string | null;
};

/**
 * Active-listing count and a representative photo per market.
 *
 * Each market costs one RealtyAPI credit per refresh regardless of resultCount,
 * so this is cached for a day and asks for a single result. Five markets = five
 * credits per day.
 *
 * When a market can't be fetched its count stays null and the card renders
 * without a number, rather than falling back to a figure we made up.
 */
export async function getMarkets(): Promise<Market[]> {
  const base = AREAS.map((a) => ({
    name: a.name,
    note: a.note,
    href: a.href,
    slot: a.slot,
    count: null as number | null,
    photo: null as string | null,
  }));

  if (!realtyConfigured()) return base;

  const results = await Promise.allSettled(
    AREAS.map((a) =>
      realtyFetch<{ total?: number }>(
        "/search/bylocation",
        { location: `${a.name}, TX`, resultCount: 1, searchType: "For_Sale" },
        { revalidate: 86400 },
      ),
    ),
  );

  return base.map((m, i) => {
    const r = results[i];
    if (r.status !== "fulfilled") return m;

    const total = typeof r.value?.total === "number" ? r.value.total : null;
    const first = extractResults(r.value)[0];
    const photo = first ? normalizeListing(first).photo : null;

    return { ...m, count: total, photo };
  });
}
