"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const STYLE =
  process.env.NEXT_PUBLIC_MAP_STYLE ||
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

export default function ListingMapInner({
  lat,
  lng,
  label,
}: {
  lat: number;
  lng: number;
  label: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!box.current || map.current) return;

    const m = new maplibregl.Map({
      container: box.current,
      style: STYLE,
      center: [lng, lat],
      zoom: 14.2,
    });
    map.current = m;
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-left");

    // Same reason as the hero map: a container that mounts at zero height
    // decides it needs no tiles and never revisits that.
    const ro = new ResizeObserver(() => m.resize());
    ro.observe(box.current);
    m.once("load", () => m.resize());

    const el = document.createElement("div");
    el.className = "map-pin is-active";
    const bubble = document.createElement("span");
    bubble.className = "pin-bubble";
    bubble.textContent = label;
    const tip = document.createElement("span");
    tip.className = "pin-tip";
    el.append(bubble, tip);

    new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat([lng, lat]).addTo(m);

    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
    };
  }, [lat, lng, label]);

  return <div ref={box} className="listing-map" />;
}
