import Link from "next/link";
import MapHero from "@/components/MapHero";
import { AREAS, REVIEWS, STATS } from "@/lib/content";
import { SAMPLE_LISTINGS } from "@/lib/sampleListings";
import { normalizeListings, realtyConfigured, realtyFetch } from "@/lib/realty";
import type { Listing } from "@/lib/realty";

export const revalidate = 300;

async function loadListings(): Promise<{ listings: Listing[]; source: "realtyapi" | "sample" }> {
  if (!realtyConfigured()) return { listings: SAMPLE_LISTINGS, source: "sample" };
  try {
    const payload = await realtyFetch("/search/bylocation", {
      location: process.env.NEXT_PUBLIC_DEFAULT_LOCATION ?? "Houston, TX",
      resultCount: 7,
      sortOrder: "Recommended",
      searchType: "For_Sale",
    });
    const listings = normalizeListings(payload, 7);
    return listings.length
      ? { listings, source: "realtyapi" }
      : { listings: SAMPLE_LISTINGS, source: "sample" };
  } catch {
    // Never let a billing or network failure take the homepage down.
    return { listings: SAMPLE_LISTINGS, source: "sample" };
  }
}

export default async function HomePage() {
  const { listings, source } = await loadListings();

  return (
    <>
      <MapHero initialListings={listings} initialSource={source} />

      <section className="stats">
        {STATS.map((s) => (
          <div className="stat" key={s.label}>
            <div className="display stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="display h2">
            Five markets,
            <br />
            street by street
          </h2>
          <p className="section-note">
            Each one prices differently, floods differently, and taxes differently. Pick one to see
            everything listed today.
          </p>
        </div>
        <div className="area-grid">
          {AREAS.map((a) => (
            <a className="area" key={a.name} href={a.href}>
              <div className="area-img">
                <span className="area-count">{a.count}</span>
                <span className="slot">{a.slot}</span>
              </div>
              <div className="area-name">{a.name}</div>
              <div className="area-note">{a.note}</div>
            </a>
          ))}
        </div>
      </section>

      <section className="split">
        <div className="split-l">
          <div className="eyebrow">BUYING</div>
          <h3 className="display h3">Know what you&rsquo;re walking into</h3>
          <p>
            Flood history, tax rate, HOA, what the house next door actually sold for. In front of
            you before you write an offer, not after.
          </p>
          <Link href="/buyers" className="arrow-link">
            For buyers →
          </Link>
        </div>
        <div className="split-r">
          <div className="eyebrow">SELLING</div>
          <h3 className="display h3">Priced right the first week</h3>
          <p>
            Most of what a listing earns is decided before it goes live. Pricing, prep, photography,
            and the negotiation that follows.
          </p>
          <Link href="/sellers" className="arrow-link">
            For sellers →
          </Link>
        </div>
      </section>

      <section className="section">
        <h2 className="display h2" style={{ marginBottom: 44 }}>
          What clients say
        </h2>
        <div className="card-grid-3">
          {REVIEWS.map((r) => (
            <div className="quote-card" key={r.name}>
              <p className="quote">{r.quote}</p>
              <div className="quote-name">{r.name}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="section-plain">
        <h2 className="display cta-title">Let&rsquo;s talk about your move</h2>
        <p className="cta-sub">
          Fifteen minutes on the phone is usually enough to tell you where you stand. No script, no
          pressure.
        </p>
        <Link href="/contact" className="btn-cta">
          Schedule a call
        </Link>
      </section>
    </>
  );
}
