"use client";

import { useEffect, useState } from "react";

/**
 * Listing gallery. One large frame with a thumbnail strip, plus a full-screen
 * viewer. Photos come from the upstream CDN at unknown dimensions, so frames
 * are aspect-ratio boxes with object-fit rather than fixed heights.
 */
export default function ListingGallery({ photos, address }: { photos: string[]; address: string }) {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);

  const count = photos.length;
  const go = (n: number) => setIndex((i) => (i + n + count) % count);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    // Don't let the page scroll behind the viewer.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, count]);

  if (!count) {
    return (
      <div className="gallery-empty">
        <span className="no-photo">No photos available</span>
      </div>
    );
  }

  return (
    <>
      <div className="gallery">
        <button
          type="button"
          className="gallery-main"
          onClick={() => setOpen(true)}
          aria-label={`View photo ${index + 1} of ${count} full screen`}
        >
          <img src={photos[index]} alt={`${address} — photo ${index + 1}`} />
          <span className="gallery-count">
            {index + 1} / {count}
          </span>
        </button>

        {count > 1 && (
          <div className="gallery-strip" role="group" aria-label="Listing photos">
            {photos.slice(0, 14).map((p, i) => (
              <button
                key={p}
                type="button"
                className={i === index ? "gallery-thumb is-active" : "gallery-thumb"}
                aria-label={`Show photo ${i + 1}`}
                aria-current={i === index}
                onClick={() => setIndex(i)}
              >
                <img src={p} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </div>

      {open && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label="Listing photos">
          <button type="button" className="lightbox-close" onClick={() => setOpen(false)}>
            Close
          </button>
          <button type="button" className="lightbox-nav prev" onClick={() => go(-1)} aria-label="Previous photo">
            ‹
          </button>
          <img className="lightbox-img" src={photos[index]} alt={`${address} — photo ${index + 1}`} />
          <button type="button" className="lightbox-nav next" onClick={() => go(1)} aria-label="Next photo">
            ›
          </button>
          <div className="lightbox-count">
            {index + 1} / {count}
          </div>
        </div>
      )}
    </>
  );
}
