"use client";

import dynamic from "next/dynamic";

/** Single-property map. Same basemap as the hero, no key required. */
const Inner = dynamic(() => import("./ListingMapInner"), {
  ssr: false,
  loading: () => <div className="listing-map is-loading" />,
});

export default function ListingMap(props: { lat: number; lng: number; label: string }) {
  return <Inner {...props} />;
}
