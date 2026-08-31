"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Listing } from "@/lib/realty";
import { rdcpix } from "@/lib/imageSizes";

type Props = {
  listings: Listing[];
  selected: number;
  onSelect: (index: number) => void;
  /** Fired after the user finishes panning/zooming, for a viewport refetch. */
  onMoveEnd?: (centre: { lat: number; lng: number; radiusMiles: number }) => void;
  /** Fired as soon as the user grabs the map, so the panel can get out of the way. */
  onInteract?: () => void;
  /** Whether the listings panel is covering the left of the map. */
  panelOpen?: boolean;
};

/** Matches .hero-panel and .nearby-rail in globals.css. */
const PANEL_W = 452;
const RAIL_W = 306;
const GUTTER = 34;
const BREAKPOINT = 900;

/**
 * The map fills the hero, but the panel and rail float on top of it. Centring a
 * pin in the map's own viewport therefore parks it underneath one of them, so
 * every camera move is padded by whatever is currently covering the map.
 */
function overlayPadding(width: number, panelOpen: boolean) {
  if (width < BREAKPOINT) {
    // Stacked layout: nothing overlaps the map strip.
    return { top: 56, bottom: 24, left: 24, right: 24 };
  }
  return {
    top: 96,
    bottom: 48,
    left: (panelOpen ? PANEL_W + GUTTER : 0) + GUTTER,
    right: RAIL_W + GUTTER + GUTTER,
  };
}

/**
 * CARTO's Positron basemap — free, no account or token, and already the muted
 * grey-cream the comp is drawn in. Attribution is required and MapLibre renders
 * it by default. Set NEXT_PUBLIC_MAP_STYLE to a MapTiler/self-hosted style URL
 * to swap it without touching this file.
 */
const STYLE =
  process.env.NEXT_PUBLIC_MAP_STYLE ||
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

const HOUSTON: [number, number] = [-95.4, 29.79];

/** Half the viewport diagonal, in miles — the radius covering what's on screen. */
function viewportRadiusMiles(map: maplibregl.Map): number {
  const b = map.getBounds();
  if (!b) return 5;
  const ne = b.getNorthEast();
  const sw = b.getSouthWest();
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(ne.lat - sw.lat);
  const dLng = toRad(ne.lng - sw.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(sw.lat)) * Math.cos(toRad(ne.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.min(Math.max((2 * R * Math.asin(Math.min(1, Math.sqrt(a)))) / 2, 1), 50);
}

export default function PropertyMap({
  listings,
  selected,
  onSelect,
  onMoveEnd,
  onInteract,
  panelOpen = true,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const popup = useRef<maplibregl.Popup | null>(null);

  const onSelectRef = useRef(onSelect);
  const onMoveEndRef = useRef(onMoveEnd);
  const onInteractRef = useRef(onInteract);
  onSelectRef.current = onSelect;
  onMoveEndRef.current = onMoveEnd;
  onInteractRef.current = onInteract;

  const userMoved = useRef(false);
  const panelOpenRef = useRef(panelOpen);
  panelOpenRef.current = panelOpen;

  const padding = () =>
    overlayPadding(container.current?.clientWidth ?? 1200, panelOpenRef.current);
  const moveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!container.current || map.current) return;

    const m = new maplibregl.Map({
      container: container.current,
      style: STYLE,
      center: HOUSTON,
      zoom: 9.2,
    });
    map.current = m;

    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-left");

    /**
     * The container can mount at zero height (dynamic import + layout timing).
     * A map sized 0 decides it needs no tiles and never reconsiders, so watch
     * the box and tell the map whenever it actually changes size.
     */
    const ro = new ResizeObserver(() => m.resize());
    ro.observe(container.current);
    m.once("load", () => m.resize());

    m.on("dragstart", () => {
      userMoved.current = true;
      onInteractRef.current?.();
    });
    m.on("zoomstart", (e) => {
      // originalEvent distinguishes a real gesture from our own fitBounds.
      if ((e as { originalEvent?: unknown }).originalEvent) {
        userMoved.current = true;
        onInteractRef.current?.();
      }
    });

    // Debounced: a search costs an API credit, so don't fire mid-pan.
    m.on("moveend", () => {
      if (!userMoved.current) return;
      userMoved.current = false;
      if (moveTimer.current) clearTimeout(moveTimer.current);
      moveTimer.current = setTimeout(() => {
        const c = m.getCenter();
        onMoveEndRef.current?.({ lat: c.lat, lng: c.lng, radiusMiles: viewportRadiusMiles(m) });
      }, 700);
    });

    return () => {
      if (moveTimer.current) clearTimeout(moveTimer.current);
      popup.current?.remove();
      popup.current = null;
      ro.disconnect();
      m.remove();
      map.current = null;
    };
  }, []);

  // Rebuild markers when listings or the selection change.
  useEffect(() => {
    const m = map.current;
    if (!m) return;

    markers.current.forEach((mk) => mk.remove());
    markers.current = [];

    const located = listings
      .map((l, i) => ({ l, i }))
      .filter(({ l }) => l.lat !== null && l.lng !== null);

    located.forEach(({ l, i }) => {
      const on = i === selected;
      const el = document.createElement("button");
      el.type = "button";
      el.className = on ? "map-pin is-active" : "map-pin";
      el.setAttribute("aria-label", `${l.priceFull} — ${l.address}`);
      el.setAttribute("aria-pressed", String(on));

      const bubble = document.createElement("span");
      bubble.className = "pin-bubble";
      bubble.textContent = l.priceShort;
      const tip = document.createElement("span");
      tip.className = "pin-tip";
      el.append(bubble, tip);

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelectRef.current(i);
      });

      markers.current.push(
        new maplibregl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([l.lng as number, l.lat as number])
          .addTo(m),
      );
    });

    // Frame the results, but don't yank the map out from under the user.
    if (located.length > 1 && !userMoved.current) {
      const b = new maplibregl.LngLatBounds();
      located.forEach(({ l }) => b.extend([l.lng as number, l.lat as number]));
      m.fitBounds(b, { padding: padding(), maxZoom: 13, duration: 600 });
    }
  }, [listings, selected]);

  /**
   * Bring the selected home into the part of the map you can actually see.
   * Padded, so it lands between the panel and the rail rather than behind one.
   */
  useEffect(() => {
    const m = map.current;
    const l = listings[selected];
    if (!m || !l || l.lat === null || l.lng === null) return;

    m.easeTo({ center: [l.lng, l.lat], padding: padding(), duration: 550 });
    // A programmatic move must not look like the user panning away.
    userMoved.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, listings, panelOpen]);

  // A card above the selected pin, linking through to the listing.
  useEffect(() => {
    const m = map.current;
    if (!m) return;

    popup.current?.remove();
    popup.current = null;

    const l = listings[selected];
    if (!l || l.lat === null || l.lng === null) return;

    const el = document.createElement("div");
    el.className = "pin-popup";

    // Prefer our own page; fall back to the source listing when there isn't one.
    const target = l.slug ? `/homes/${l.slug}` : l.href;
    const inner = target ? document.createElement("a") : document.createElement("div");
    inner.className = "pin-popup-inner";
    if (target && inner instanceof HTMLAnchorElement) {
      inner.href = target;
      if (!l.slug) {
        inner.target = "_blank";
        inner.rel = "noopener noreferrer";
      }
    }

    const img = document.createElement("span");
    img.className = l.photo ? "pin-popup-photo" : "pin-popup-photo is-empty";
    if (l.photo) {
      img.style.backgroundImage = `url(${rdcpix(l.photo, "x")})`;
    } else {
      // Some listings genuinely carry no photos; say so rather than showing
      // an empty grey box that reads as a loading failure.
      img.textContent = "No photo available";
    }
    inner.appendChild(img);

    const body = document.createElement("span");
    body.className = "pin-popup-body";

    const addr = document.createElement("span");
    addr.className = "pin-popup-addr";
    addr.textContent = l.address;

    const specs = document.createElement("span");
    specs.className = "pin-popup-specs";
    specs.textContent = l.specs;

    body.append(addr, specs);

    if (target) {
      const cta = document.createElement("span");
      cta.className = "pin-popup-cta";
      cta.textContent = l.slug ? "See this home \u2192" : "View on source \u2192";
      body.appendChild(cta);
    }

    inner.appendChild(body);
    el.appendChild(inner);

    popup.current = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      /**
       * No fixed anchor: MapLibre then picks the side with room and flips the
       * card when the pin is near an edge. Offsets keep it clear of the price
       * bubble (~46px tall with its tip) whichever side it lands on.
       */
      offset: {
        bottom: [0, -52],
        "bottom-left": [0, -52],
        "bottom-right": [0, -52],
        top: [0, 14],
        "top-left": [0, 14],
        "top-right": [0, 14],
        left: [16, -18],
        right: [-16, -18],
        center: [0, -52],
      },
      maxWidth: "260px",
      className: "listing-popup",
    })
      .setLngLat([l.lng, l.lat])
      .setDOMContent(el)
      .addTo(m);

    return () => {
      popup.current?.remove();
      popup.current = null;
    };
  }, [listings, selected]);

  return <div ref={container} className="map-canvas" />;
}
