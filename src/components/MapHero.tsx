"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FILTERS, FILTER_QUERY, IDX } from "@/lib/content";
import type { Listing } from "@/lib/realty";

/** maplibre-gl is ~250 kB, so keep it out of the initial homepage bundle. */
const PropertyMap = dynamic(() => import("./PropertyMap"), {
  ssr: false,
  loading: () => <div className="map-canvas map-loading" />,
});

type Props = { initialListings: Listing[]; initialSource: "realtyapi" | "sample" };

/** Great-circle distance in miles, or null when either point lacks coordinates. */
function milesBetween(a: Listing, b: Listing): number | null {
  if (a.lat === null || a.lng === null || b.lat === null || b.lng === null) return null;
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export default function MapHero({ initialListings, initialSource }: Props) {
  const [listings, setListings] = useState(initialListings);
  const [source, setSource] = useState(initialSource);
  const [selected, setSelected] = useState(0);
  const [filter, setFilter] = useState(FILTERS[0]);
  const [query, setQuery] = useState("");
  const [draw, setDraw] = useState(false);
  const [loading, setLoading] = useState(false);
  /** Mobile only — desktop shows both panes side by side. */
  const [view, setView] = useState<"map" | "list">("map");
  /** Desktop: collapse the panel via the edge grip to open up the map. */
  const [panelOpen, setPanelOpen] = useState(true);
  /** The headline card yields to the map a few seconds after load. */
  const [introVisible, setIntroVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setIntroVisible(false), 3000);
    return () => clearTimeout(t);
  }, []);

  const submittedRef = useRef("");
  const reqRef = useRef(0);

  /** Pagination for the nearby rail's endless scroll. */
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const railRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  /** Redfin ids already asked about, so we never re-spend a credit on one. */
  const photoAsked = useRef<Set<string>>(new Set());
  /** The viewport/filter that the current page sequence belongs to. */
  const lastQueryRef = useRef<URLSearchParams | null>(null);

  /** Google Places suggestions for the search box. */
  const [suggestions, setSuggestions] = useState<{ text: string; isAddress: boolean }[]>([]);
  const [sugOpen, setSugOpen] = useState(false);
  const [sugIndex, setSugIndex] = useState(-1);
  const sugSeq = useRef(0);

  const load = useCallback(
    async (
      nextFilter: string,
      location: string,
      coords?: { lat: number; lng: number; radiusMiles: number },
    ) => {
      const seq = ++reqRef.current;
      setLoading(true);
      try {
        const params = new URLSearchParams({ limit: "12", ...FILTER_QUERY[nextFilter] });
        if (coords) {
          params.set("latitude", String(coords.lat));
          params.set("longitude", String(coords.lng));
          params.set("radius", String(coords.radiusMiles));
        } else if (location.trim()) {
          if (/^\d{5}$/.test(location.trim())) params.set("zipCode", location.trim());
          else params.set("location", location.trim());
        }

        const res = await fetch(`/api/realty/search?${params}`);
        const data = await res.json();
        // Ignore a slow response a newer request has already superseded.
        if (seq !== reqRef.current) return;

        if (Array.isArray(data.listings) && data.listings.length) {
          setListings(data.listings);
          setSource(data.source === "realtyapi" ? "realtyapi" : "sample");
          setSelected(0);
          // A new search restarts the page sequence.
          lastQueryRef.current = params;
          setPage(1);
          setHasMore(Boolean(data.nextPage));
          railRef.current?.scrollTo({ top: 0 });
        }
      } catch {
        /* keep the current listings on a network blip */
      } finally {
        if (seq === reqRef.current) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (filter === FILTERS[0] && submittedRef.current === "") return;
    void load(filter, submittedRef.current);
  }, [filter, load]);

  // Debounced so a fast typist doesn't fire a request per keystroke.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || q === submittedRef.current) {
      setSuggestions([]);
      return;
    }
    const seq = ++sugSeq.current;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (seq !== sugSeq.current) return;
        setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
        setSugIndex(-1);
      } catch {
        /* no suggestions is a fine outcome */
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const runSearch = useCallback(
    (term: string) => {
      submittedRef.current = term;
      setQuery(term);
      setSugOpen(false);
      setSuggestions([]);
      void load(filter, term);
    },
    [filter, load],
  );

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    const base = lastQueryRef.current ?? new URLSearchParams({ limit: "12" });
    setLoadingMore(true);
    try {
      const params = new URLSearchParams(base);
      const next = page + 1;
      params.set("page", String(next));
      const res = await fetch(`/api/realty/search?${params}`);
      const data = await res.json();
      const incoming: Listing[] = Array.isArray(data.listings) ? data.listings : [];

      if (incoming.length) {
        setListings((prev) => {
          // Upstream pages can repeat a property; key on id so the rail can't
          // show the same home twice.
          const seen = new Set(prev.map((l) => l.id));
          return [...prev, ...incoming.filter((l) => !seen.has(l.id))];
        });
        setPage(next);
        setHasMore(Boolean(data.nextPage));
      } else {
        setHasMore(false);
      }
    } catch {
      /* leave hasMore alone so a retry is possible */
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, page]);

  /** Endless scroll for the left result list. */
  const onListScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 300) void loadMore();
  }, [loadMore]);

  /** Endless scroll: pull the next page as the rail nears its end. */
  const onRailScroll = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    const horizontal = el.scrollWidth > el.clientWidth + 8;
    const nearEnd = horizontal
      ? el.scrollLeft + el.clientWidth >= el.scrollWidth - 320
      : el.scrollTop + el.clientHeight >= el.scrollHeight - 400;
    if (nearEnd) void loadMore();
  }, [loadMore]);

  /**
   * Redfin's search payload has no photo URLs, so resolve them after render,
   * a few at a time. Lazy rather than up-front: the page paints immediately and
   * we only spend a credit on listings someone actually sees. Server-side these
   * are cached for a week, so repeat viewers cost nothing.
   */
  useEffect(() => {
    const pending = listings.filter(
      (l) =>
        l.provider === "redfin" &&
        !l.photo &&
        l.propertyId &&
        l.listingId &&
        !photoAsked.current.has(l.id),
    );
    if (!pending.length) return;

    let cancelled = false;

    (async () => {
      const CONCURRENCY = 3;
      for (let i = 0; i < pending.length && !cancelled; i += CONCURRENCY) {
        const batch = pending.slice(i, i + CONCURRENCY);
        batch.forEach((l) => photoAsked.current.add(l.id));

        const resolved = await Promise.all(
          batch.map(async (l) => {
            try {
              const res = await fetch(
                `/api/redfin/photo?property_id=${l.propertyId}&listing_id=${l.listingId}`,
              );
              const data = await res.json();
              return typeof data.photo === "string" ? { id: l.id, photo: data.photo } : null;
            } catch {
              return null;
            }
          }),
        );

        if (cancelled) return;
        const found = resolved.filter((r): r is { id: string; photo: string } => r !== null);
        if (found.length) {
          setListings((prev) =>
            prev.map((l) => {
              const hit = found.find((f) => f.id === l.id);
              return hit ? { ...l, photo: hit.photo } : l;
            }),
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [listings]);

  const handleMoveEnd = useCallback(
    (c: { lat: number; lng: number; radiusMiles: number }) => void load(filter, "", c),
    [filter, load],
  );

  const active = listings[selected] ?? listings[0];

  /** Nearest-first, so the rail reads as "this home, then its neighbours". */
  const nearby = useMemo(() => {
    const a = listings[selected];
    const rows = listings.map((l, i) => ({
      l,
      i,
      dist: a ? milesBetween(a, l) : null,
    }));
    if (!a) return rows;
    return rows.sort((x, y) => {
      if (x.i === selected) return -1;
      if (y.i === selected) return 1;
      return (x.dist ?? Number.POSITIVE_INFINITY) - (y.dist ?? Number.POSITIVE_INFINITY);
    });
  }, [listings, selected]);

  if (!active) return null;

  return (
    <section className={`hero view-${view}${panelOpen ? "" : " panel-closed"}`}>
      <div className="hero-map">
        <PropertyMap
          listings={listings}
          selected={selected}
          onSelect={setSelected}
          onMoveEnd={handleMoveEnd}
        />
      </div>

      <div className="hero-panel" id="listing-panel">
        <div className="hero-panel-inner">
          <div className={introVisible ? "hero-card" : "hero-card is-gone"} aria-hidden={!introVisible}>
            <h1 className="display hero-title">
              Start with the map,
              <br />
              <em>not the brochure.</em>
            </h1>
            <p className="hero-sub">
              Every active listing across Greater Houston, with an honest read on the neighborhood
              behind each pin.
            </p>
          </div>

          <div className="search-shell">
            {/* Thumb grip, centred on the search card. */}
            <button
              type="button"
              className="panel-grip"
              aria-expanded={panelOpen}
              aria-controls="listing-panel"
              onClick={() => setPanelOpen((v) => !v)}
            >
              <span className="panel-grip-lines" aria-hidden />
              <span className="sr-only">
                {panelOpen ? "Collapse listings and show the full map" : "Show listings"}
              </span>
            </button>

            <div className="search-card">
            <form
              className="search-row"
              onSubmit={(e) => {
                e.preventDefault();
                const pick = sugIndex >= 0 ? suggestions[sugIndex]?.text : undefined;
                runSearch(pick ?? query);
              }}
              role="search"
            >
              <span className="search-icon" aria-hidden />
              <input
                className="search-input"
                placeholder="City, ZIP, neighborhood, or MLS #"
                aria-label="Search listings by city, ZIP, or neighborhood"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSugOpen(true);
                }}
                onFocus={() => setSugOpen(true)}
                onBlur={() => setTimeout(() => setSugOpen(false), 120)}
                onKeyDown={(e) => {
                  if (!suggestions.length) return;
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setSugIndex((i) => (i + 1) % suggestions.length);
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setSugIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
                  } else if (e.key === "Escape") {
                    setSugOpen(false);
                  }
                }}
                role="combobox"
                aria-expanded={sugOpen && suggestions.length > 0}
                aria-controls="place-suggestions"
                aria-autocomplete="list"
                autoComplete="off"
              />
              <button type="submit" className="sr-only">
                Search
              </button>

              {sugOpen && suggestions.length > 0 && (
                <ul className="suggestions" id="place-suggestions" role="listbox">
                  {suggestions.map((s, i) => (
                    <li key={`${s.text}-${i}`} role="option" aria-selected={i === sugIndex}>
                      <button
                        type="button"
                        className={i === sugIndex ? "suggestion is-active" : "suggestion"}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => runSearch(s.text)}
                      >
                        <span className="suggestion-icon" aria-hidden>
                          {s.isAddress ? "\u2302" : "\u25CE"}
                        </span>
                        {s.text}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </form>

            <div className="filter-row" role="group" aria-label="Quick filters">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  className="chip"
                  aria-pressed={filter === f}
                  onClick={() => setFilter(f)}
                >
                  {f}
                </button>
              ))}
            </div>

            <div
              className="result-list"
              aria-busy={loading}
              ref={listRef}
              onScroll={onListScroll}
            >
              {listings.map((l, i) => (
                <button
                  key={l.id}
                  type="button"
                  className="result"
                  aria-current={i === selected}
                  onClick={() => setSelected(i)}
                >
                  <span
                    className="result-thumb"
                    style={l.photo ? { backgroundImage: `url(${l.photo})` } : undefined}
                    aria-hidden
                  />
                  <span className="result-body">
                    <span className="result-price" style={{ display: "block" }}>
                      {l.priceFull}
                    </span>
                    <span className="result-specs" style={{ display: "block" }}>
                      {l.specs}
                    </span>
                    <span className="result-addr" style={{ display: "block" }}>
                      {l.address}
                    </span>
                  </span>
                </button>
              ))}

              {hasMore && (
                <button
                  type="button"
                  className="list-more"
                  onClick={() => void loadMore()}
                  disabled={loadingMore}
                >
                  {loadingMore ? "Loading more…" : "Load more listings"}
                </button>
              )}
            </div>

            <div className="search-actions">
              <a href={`${IDX}/idx/map/mapsearch`} className="btn-solid">
                Search all listings
              </a>
              <Link href="/sellers" className="btn-ghost">
                Free valuation
              </Link>
            </div>
            </div>
          </div>
        </div>
      </div>

      <div className="view-toggle" role="group" aria-label="Choose map or list view">
        <button type="button" aria-pressed={view === "map"} onClick={() => setView("map")}>
          Map
        </button>
        <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}>
          List
        </button>
      </div>

      <div className="hero-badges">
        <div className="badge">
          <span className="badge-dot" aria-hidden />
          {listings.length} homes in view
        </div>
        <button
          type="button"
          className="badge badge-toggle"
          aria-pressed={draw}
          onClick={() => setDraw((v) => !v)}
        >
          Draw search area
        </button>
      </div>

      {source === "sample" && (
        <div className="data-note">SAMPLE INVENTORY — ADD REALTYAPI_KEY FOR LIVE MLS</div>
      )}

      {/* Nearby listings, nearest first — the chosen home and its neighbours. */}
      <div className="nearby-rail" aria-label="Nearby listings" ref={railRef} onScroll={onRailScroll}>
        {nearby.map(({ l, i, dist }) => {
          const on = i === selected;
          const card = (
            <>
              <div
                className="active-photo"
                style={l.photo ? { backgroundImage: `url(${l.photo})` } : undefined}
              >
                {!l.photo && <span className="slot">[ listing photo ]</span>}
                {dist !== null && !on && (
                  <span className="nearby-dist">
                    {dist < 0.1 ? "next door" : `${dist.toFixed(1)} mi away`}
                  </span>
                )}
              </div>
              <div className="active-body">
                <div className="active-head">
                  <div className="active-price">{l.priceFull}</div>
                  <div className="active-status">{l.status.toUpperCase()}</div>
                </div>
                <div className="active-addr">{l.address}</div>
                <div className="active-specs">{l.specs}</div>
              </div>
            </>
          );

          return (
            <div
              key={l.id}
              className={on ? "nearby-card is-active" : "nearby-card"}
              aria-current={on}
            >
              <button
                type="button"
                className="nearby-hit"
                onClick={() => setSelected(i)}
                aria-label={`Show ${l.priceFull}, ${l.address} on the map`}
              >
                {card}
              </button>
              {l.href && (
                <a
                  className="nearby-open"
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View listing →
                </a>
              )}
            </div>
          );
        })}

        {hasMore ? (
          <button type="button" className="rail-more" onClick={() => void loadMore()}>
            {loadingMore ? "Loading more…" : "Load more listings"}
          </button>
        ) : (
          listings.length > 12 && <div className="rail-end">End of results</div>
        )}
      </div>
    </section>
  );
}
