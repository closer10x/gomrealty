"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { FILTERS, FILTER_QUERY, IDX } from "@/lib/content";
import { PIN_POSITIONS } from "@/lib/sampleListings";
import type { Listing } from "@/lib/realty";

type Props = { initialListings: Listing[]; initialSource: "realtyapi" | "sample" };

/**
 * The design's map hero. Pins, the result list, and the detail card are driven
 * by whatever /api/realty/search returns; when that is sample data the strip
 * says so rather than passing stock inventory off as live.
 */
export default function MapHero({ initialListings, initialSource }: Props) {
  const [listings, setListings] = useState(initialListings);
  const [source, setSource] = useState(initialSource);
  const [selected, setSelected] = useState(0);
  const [filter, setFilter] = useState(FILTERS[0]);
  const [query, setQuery] = useState("");
  const [zoom, setZoom] = useState(1);
  const [draw, setDraw] = useState(false);
  const [loading, setLoading] = useState(false);

  const submittedRef = useRef("");

  /** Refetch when the filter chip or the submitted search term changes. */
  async function load(nextFilter: string, location: string) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "7", ...FILTER_QUERY[nextFilter] });
      if (location.trim()) {
        // A bare 5-digit value is a ZIP; anything else is a free-text location.
        if (/^\d{5}$/.test(location.trim())) params.set("zipCode", location.trim());
        else params.set("location", location.trim());
      }
      const res = await fetch(`/api/realty/search?${params}`);
      const data = await res.json();
      if (Array.isArray(data.listings) && data.listings.length) {
        setListings(data.listings);
        setSource(data.source === "realtyapi" ? "realtyapi" : "sample");
        setSelected(0);
      }
    } catch {
      /* keep the current listings on a network blip */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Skip the first run — the server already supplied initialListings.
    if (filter === FILTERS[0] && submittedRef.current === "") return;
    void load(filter, submittedRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const active = listings[selected] ?? listings[0];

  const pins = useMemo(
    () =>
      listings.map((l, i) => ({
        listing: l,
        pos: PIN_POSITIONS[i % PIN_POSITIONS.length],
      })),
    [listings],
  );

  if (!active) return null;

  return (
    <section className="hero">
      <div className="hero-map" aria-hidden>
        <div className="hero-grid" />
        <div className="blk-park-a" />
        <div className="blk-park-b" />
        <div className="blk-water" />
        <div className="rd-i10" />
        <div className="rd-i10-ln" />
        <div className="rd-blt" />
        <div className="rd-minor" />
        <div className="map-label lbl-park">BEAR CREEK PARK</div>
        <div className="map-label lbl-bayou">BUFFALO BAYOU</div>
        <div className="map-label lbl-i10">I-10 KATY FWY</div>
        <div className="map-label lbl-blt">BELTWAY 8</div>

        <div className="pin-layer">
          {pins.map(({ listing, pos }, i) => {
            const on = i === selected;
            return (
              <button
                key={listing.id}
                type="button"
                className="pin"
                aria-label={`${listing.priceFull} — ${listing.address}`}
                aria-pressed={on}
                onClick={() => setSelected(i)}
                style={{
                  left: pos.left,
                  top: pos.top,
                  transform: `translate(-50%, -100%) scale(${(on ? 1.14 : 1) * zoom})`,
                  zIndex: on ? 50 : 20,
                }}
              >
                <span
                  className="pin-bubble"
                  style={{
                    background: on ? "var(--brand-mid)" : "var(--surface)",
                    color: on ? "var(--on-brand-hi)" : "var(--brand)",
                  }}
                >
                  {listing.priceShort}
                </span>
                <span
                  className="pin-tip"
                  style={{ borderTop: `8px solid ${on ? "var(--brand-mid)" : "var(--surface)"}` }}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className="hero-panel">
        <div className="hero-card">
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

        <div className="search-card">
          <form
            className="search-row"
            onSubmit={(e) => {
              e.preventDefault();
              submittedRef.current = query;
              void load(filter, query);
            }}
          >
            <span className="search-icon" aria-hidden />
            <input
              className="search-input"
              placeholder="City, ZIP, neighborhood, or MLS #"
              aria-label="Search listings by city, ZIP, or neighborhood"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="submit" className="sr-only">
              Search
            </button>
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

          <div className="result-list" aria-busy={loading}>
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

      <div className="zoom">
        <button type="button" onClick={() => setZoom((z) => Math.min(1.3, z + 0.1))} aria-label="Zoom in">
          +
        </button>
        <button type="button" onClick={() => setZoom((z) => Math.max(0.8, z - 0.1))} aria-label="Zoom out">
          −
        </button>
      </div>

      <div className="active-card">
        <div
          className="active-photo"
          style={active.photo ? { backgroundImage: `url(${active.photo})` } : undefined}
        >
          {!active.photo && <span className="slot">[ listing photo ]</span>}
        </div>
        <div className="active-body">
          <div className="active-head">
            <div className="active-price">{active.priceFull}</div>
            <div className="active-status">{active.status.toUpperCase()}</div>
          </div>
          <div className="active-addr">{active.address}</div>
          <div className="active-specs">{active.specs}</div>
        </div>
      </div>
    </section>
  );
}
