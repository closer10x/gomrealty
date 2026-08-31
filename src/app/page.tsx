import Link from "next/link";
import MapHero from "@/components/MapHero";
import { REVIEWS, SOFI_LAKES, STATS } from "@/lib/content";
import { getMarkets } from "@/lib/markets";
import { SAMPLE_LISTINGS } from "@/lib/sampleListings";
import { normalizeListings, realtyConfigured, realtyFetch } from "@/lib/realty";
import type { Listing } from "@/lib/realty";

export const revalidate = 3600;

async function loadListings(): Promise<{ listings: Listing[]; source: "realtyapi" | "sample" }> {
  if (!realtyConfigured()) return { listings: SAMPLE_LISTINGS, source: "sample" };
  try {
    const payload = await realtyFetch("/search/bylocation", {
      location: process.env.NEXT_PUBLIC_DEFAULT_LOCATION ?? "Houston, TX",
      resultCount: 7,
      sortOrder: "Recommended",
      searchType: "For_Sale",
    }, { revalidate: 3600 });
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
  const [{ listings, source }, markets] = await Promise.all([loadListings(), getMarkets()]);

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
          {markets.map((m) => (
            <a className="area" key={m.name} href={m.href}>
              <div
                className="area-img"
                style={m.photo ? { backgroundImage: `url(${m.photo})` } : undefined}
              >
                {/* No count rather than an invented one when the market is unknown. */}
                {m.count !== null && (
                  <span className="area-count">
                    {m.count.toLocaleString("en-US")} active
                  </span>
                )}
                {!m.photo && <span className="slot">{m.slot}</span>}
              </div>
              <div className="area-name">{m.name}</div>
              <div className="area-note">{m.note}</div>
            </a>
          ))}
        </div>
      </section>

      <section className="section community">
        <div className="community-copy">
          <div className="eyebrow">FEATURED COMMUNITY</div>
          <h2 className="display h3">{SOFI_LAKES.name}</h2>
          <div className="community-place">{SOFI_LAKES.place}</div>
          <p>
            Five builders on 390 homesites in west Katy, with 150 acres of green space and more
            than five miles of trail. {SOFI_LAKES.amenities}
          </p>
          <p>
            Worth knowing before you tour: it sits in Waller County on Royal ISD, not Katy ISD,
            and an 11.8-acre school site is reserved inside the community. Only 24 of the 390
            homes touch the water, and the HOA runs $1,350 a year.
          </p>
          <div className="community-builders">
            {SOFI_LAKES.builders.map((b) => (
              <span className="community-builder" key={b}>
                {b}
              </span>
            ))}
          </div>
          <a className="arrow-link" href={SOFI_LAKES.href} target="_blank" rel="noopener noreferrer">
            Visit sofilakes.com &rarr;
          </a>
        </div>
        <div className="community-media">
          <div className="community-photos">
            {SOFI_LAKES.photos.map((ph) => (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img className="community-photo" key={ph.src} src={ph.src} alt={ph.alt} loading="lazy" />
            ))}
          </div>
          <div className="community-facts">
            {SOFI_LAKES.facts.map((f) => (
              <div className="community-fact" key={f.label}>
                <div className="display community-fact-value">{f.value}</div>
                <div className="community-fact-label">{f.label}</div>
              </div>
            ))}
          </div>
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
        <Link href="/book" className="btn-cta">
          Schedule a call
        </Link>
      </section>
    </>
  );
}
