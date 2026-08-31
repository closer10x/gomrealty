"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Listing } from "@/lib/realty";

type Props = {
  listings: Listing[];
  selected: number;
  onSelect: (index: number) => void;
  /** Fired after the user finishes panning/zooming, for a viewport refetch. */
  onMoveEnd?: (centre: { lat: number; lng: number; radiusMiles: number }) => void;
};

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const STYLE = process.env.NEXT_PUBLIC_MAPBOX_STYLE || "mapbox://styles/mapbox/light-v11";
const HOUSTON: [number, number] = [-95.4, 29.79];

/** Half the viewport diagonal, in miles — the radius that covers what's on screen. */
function viewportRadiusMiles(map: mapboxgl.Map): number {
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
  const diagonal = 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  return Math.min(Math.max(diagonal / 2, 0.5), 50);
}

export default function PropertyMap({ listings, selected, onSelect, onMoveEnd }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);

  // Keep the latest handlers without re-running the map-init effect.
  const onSelectRef = useRef(onSelect);
  const onMoveEndRef = useRef(onMoveEnd);
  onSelectRef.current = onSelect;
  onMoveEndRef.current = onMoveEnd;

  const userMoved = useRef(false);

  useEffect(() => {
    if (!container.current || map.current || !TOKEN) return;

    mapboxgl.accessToken = TOKEN;
    const m = new mapboxgl.Map({
      container: container.current,
      style: STYLE,
      center: HOUSTON,
      zoom: 9.2,
      attributionControl: true,
    });
    map.current = m;

    m.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-left");

    // Only refetch on a move the user actually drove; fitBounds also fires moveend.
    m.on("dragstart", () => (userMoved.current = true));
    m.on("zoomstart", (e) => {
      if ((e as { originalEvent?: unknown }).originalEvent) userMoved.current = true;
    });
    m.on("moveend", () => {
      if (!userMoved.current) return;
      userMoved.current = false;
      const c = m.getCenter();
      onMoveEndRef.current?.({ lat: c.lat, lng: c.lng, radiusMiles: viewportRadiusMiles(m) });
    });

    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  // Rebuild markers whenever the listings or the selection change.
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
      el.className = on ? "mapbox-pin is-active" : "mapbox-pin";
      el.setAttribute("aria-label", `${l.priceFull} — ${l.address}`);
      el.setAttribute("aria-pressed", String(on));
      el.innerHTML = `<span class="pin-bubble"></span><span class="pin-tip"></span>`;
      const bubble = el.querySelector(".pin-bubble") as HTMLElement;
      bubble.textContent = l.priceShort;
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelectRef.current(i);
      });

      markers.current.push(
        new mapboxgl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([l.lng as number, l.lat as number])
          .addTo(m),
      );
    });

    // Frame the results, but don't yank the map while the user is reading one.
    if (located.length > 1 && !userMoved.current) {
      const b = new mapboxgl.LngLatBounds();
      located.forEach(({ l }) => b.extend([l.lng as number, l.lat as number]));
      m.fitBounds(b, { padding: 80, maxZoom: 13, duration: 600 });
    } else if (located.length === 1) {
      m.easeTo({ center: [located[0].l.lng as number, located[0].l.lat as number], zoom: 13 });
    }
  }, [listings, selected]);

  // Ease to the active listing when it's picked from the list.
  useEffect(() => {
    const m = map.current;
    const l = listings[selected];
    if (!m || !l || l.lat === null || l.lng === null) return;
    m.easeTo({ center: [l.lng, l.lat], duration: 500 });
  }, [selected, listings]);

  if (!TOKEN) return null;
  return <div ref={container} className="mapbox-canvas" />;
}
