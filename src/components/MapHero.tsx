"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { FILTERS, FILTER_QUERY, IDX } from "@/lib/content";
import { PIN_POSITIONS } from "@/lib/sampleListings";
import dynamic from "next/dynamic";
import DecorativeMap from "./DecorativeMap";
import type { Listing } from "@/lib/realty";

/**
 * mapbox-gl is ~500 kB. Load it only when a token actually exists, so the
 * homepage bundle is unchanged for anyone running without one.
 */
const PropertyMap = dynamic(() => import("./PropertyMap"), { ssr: false });

type Props = { initialListings: Listing[]; initialSource: "realtyapi" | "sample" };

const HAS_MAP = Boolean(process.env.NEXT_PUBLIC_MAPBOX_TOKEN);

export default function MapHero({ initialListings, initialSource }: Props) {
  const [listings, setListings] = useState(initialListings);
  const [source, setSource] = useState(initialSource);
  const [selected, setSelected] = useState(0);
  const [filter, setFilter] = useState(FILTERS[0]);
  const [query, setQuery] = useState("");
  const [zoom, setZoom] = useState(1);
  const [draw, setDraw] = useState(false);
  const [loading, setLoading] = useState(false);
  /** Mobile only — desktop shows both panes side by side. */
  const [view, setView] = useState<"map" | "list">("map");

  const submittedRef = useRef("");
  const reqRef = useRef(0);

  const load = useCallback(
    async (nextFilter: string, location: string, coords?: { lat: number; lng: number; radiusMiles: number }) => {
      const seq = ++reqRef.current;
      setLoading(true);
      try {
        const params = new URLSearchParams({ limit: "12", ...FILTER_QUERY[nextFilter] });
        if (coords) {
          params.set("latitude", String(coords.lat));
          params.set("longitude", String(coords.lng));
          params.set("radius", coords.radiusMiles.toFixed(1));
        } else if (location.trim()) {
          if (/^\d{5}$/.test(location.trim())) params.set("zipCode", location.trim());
          else params.set("location", location.trim());
        }

        const res = await fetch(`/api/realty/search?${params}`);
        const data = await res.json();
        // Ignore a slow response that a newer request has already superseded.
        if (seq !== reqRef.current) return;

        if (Array.isArray(data.listings) && data.listings.length) {
          setListings(data.listings);
          setSource(data.source === "realtyapi" ? "realtyapi" : "sample");
          setSelected(0);
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

  const handleMoveEnd = useCallback(
    (c: { lat: number; lng: number; radiusMiles: number }) => {
      void load(filter, "", c);
    },
    [filter, load],
  );

  const active = listings[selected] ?? listings[0];
  if (!active) return null;

  return (
    <section className={`hero${HAS_MAP ? " hero-live" : ""} view-${view}`}>
      <div className="hero-map" aria-hidden={!HAS_MAP}>
        {HAS_MAP ? (
          <PropertyMap
            listings={listings}
            selected={selected}
            onSelect={setSelected}
            onMoveEnd={handleMoveEnd}
          />
        ) : (
          <>
            <DecorativeMap />
            <div className="pin-layer">
              {listings.slice(0, PIN_POSITIONS.length).map((l, i) => {
                const on = i === selected;
                const pos = PIN_POSITIONS[i % PIN_POSITIONS.length];
                return (
                  <button
                    key={l.id}
                    type="button"
                    className="pin"
                    aria-label={`${l.priceFull} — ${l.address}`}
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
                      {l.priceShort}
                    </span>
                    <span
                      className="pin-tip"
                      style={{ borderTop: `8px solid ${on ? "var(--brand-mid)" : "var(--surface)"}` }}
                    />
                  </button>
                );
              })}
            </div>
          </>
        )}
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

      {/* Mobile-only Map / List switch; desktop shows both panes. */}
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

      {!HAS_MAP && (
        <div className="zoom">
          <button type="button" onClick={() => setZoom((z) => Math.min(1.3, z + 0.1))} aria-label="Zoom in">
            +
          </button>
          <button type="button" onClick={() => setZoom((z) => Math.max(0.8, z - 0.1))} aria-label="Zoom out">
            −
          </button>
        </div>
      )}

      <div className="active-card">
        {active.href ? (
          <a className="active-photo-link" href={active.href} target="_blank" rel="noopener noreferrer">
            <div
              className="active-photo"
              style={active.photo ? { backgroundImage: `url(${active.photo})` } : undefined}
            >
              {!active.photo && <span className="slot">[ listing photo ]</span>}
            </div>
          </a>
        ) : (
          <div
            className="active-photo"
            style={active.photo ? { backgroundImage: `url(${active.photo})` } : undefined}
          >
            {!active.photo && <span className="slot">[ listing photo ]</span>}
          </div>
        )}
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
