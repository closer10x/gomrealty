import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ListingGallery from "@/components/ListingGallery";
import ListingMap from "@/components/ListingMap";
import { getListing } from "@/lib/listing";
import { SITE } from "@/lib/content";

export const revalidate = 86400;

type Props = { params: Promise<{ slug: string }> };

const money = (n: number | null) => (n === null ? null : `$${n.toLocaleString("en-US")}`);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const l = await getListing(slug);
  if (!l) return { title: "Listing not found", robots: { index: false } };

  const where = [l.line, l.city, l.state].filter(Boolean).join(", ");
  const specs = [
    l.beds !== null ? `${l.beds} bed` : null,
    l.baths !== null ? `${l.baths} bath` : null,
    l.sqft !== null ? `${l.sqft.toLocaleString("en-US")} sqft` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const title = `${money(l.price) ?? "For sale"} — ${where}`;
  const description =
    l.description?.slice(0, 155) ??
    `${specs} in ${l.city ?? "Greater Houston"}. Flood risk, schools and price history, with Go-M Realty.`;

  return {
    title,
    description,
    alternates: { canonical: `/homes/${l.slug}` },
    openGraph: {
      title,
      description,
      type: "website",
      images: l.photos[0] ? [{ url: l.photos[0] }] : undefined,
    },
  };
}

export default async function ListingPage({ params }: Props) {
  const { slug } = await params;
  const l = await getListing(slug);
  if (!l) notFound();

  const where = [l.city, l.state].filter(Boolean).join(", ");
  const specs = [
    l.beds !== null ? `${l.beds} bd` : null,
    l.baths !== null ? `${l.baths} ba` : null,
    l.sqft !== null ? `${l.sqft.toLocaleString("en-US")} sqft` : null,
  ].filter(Boolean);

  // Only facts we actually have. A grid of em-dashes reads as a broken page,
  // and these payloads legitimately omit year built, lot size and HOA.
  const facts = (
    [
      ["Type", l.propertyType],
      ["Year built", l.yearBuilt ? String(l.yearBuilt) : null],
      ["Stories", l.stories ? String(l.stories) : null],
      ["Garage", l.garage ? `${l.garage} car` : null],
      ["Lot", l.lotSqft ? `${l.lotSqft.toLocaleString("en-US")} sqft` : null],
      ["Price / sqft", l.pricePerSqft ? `$${l.pricePerSqft}` : null],
      ["HOA", l.hoaFee ? `$${l.hoaFee}/mo` : null],
      ["MLS #", l.mls],
    ] as [string, string | null][]
  ).filter((f): f is [string, string] => Boolean(f[1]));

  // Structured data, so the page can win a rich result rather than just exist.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SingleFamilyResidence",
    name: `${l.line}, ${where}`,
    address: {
      "@type": "PostalAddress",
      streetAddress: l.line,
      addressLocality: l.city ?? undefined,
      addressRegion: l.state ?? undefined,
      postalCode: l.postal ?? undefined,
      addressCountry: "US",
    },
    ...(l.lat && l.lng
      ? { geo: { "@type": "GeoCoordinates", latitude: l.lat, longitude: l.lng } }
      : {}),
    ...(l.sqft
      ? { floorSize: { "@type": "QuantitativeValue", value: l.sqft, unitCode: "FTK" } }
      : {}),
    numberOfRooms: l.beds ?? undefined,
    photo: l.photos.slice(0, 6),
    ...(l.price
      ? {
          offers: {
            "@type": "Offer",
            price: l.price,
            priceCurrency: "USD",
            availability: "https://schema.org/InStock",
          },
        }
      : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Map</Link>
        <span aria-hidden>/</span>
        <span>{where || "Listing"}</span>
      </nav>

      <ListingGallery photos={l.photos} address={`${l.line}, ${where}`} />

      <section className="listing-head">
        <div>
          <div className="listing-status">{l.status.toUpperCase()}</div>
          <h1 className="display listing-price">{money(l.price) ?? "Price on request"}</h1>
          <p className="listing-addr">
            {l.line}
            {where ? `, ${where}` : ""} {l.postal ?? ""}
          </p>
          <p className="listing-specs">{specs.join(" · ") || "Details on request"}</p>
        </div>

        <div className="listing-cta">
          <Link href="/book" className="btn-cta">
            Book a call about this home
          </Link>
          <p className="listing-cta-note">
            Or call <a href={SITE.phoneHref}>{SITE.phone}</a>. We&rsquo;ll tell you what the listing
            photos left out.
          </p>
        </div>
      </section>

      {facts.length > 0 && (
      <section className="section">
        <div className="fact-grid">
          {facts.map(([k, v]) => (
            <div className="fact" key={k}>
              <div className="fact-k">{k}</div>
              <div className="fact-v">{v}</div>
            </div>
          ))}
        </div>
      </section>
      )}

      {l.description && (
        <section className="section">
          <h2 className="display h3">About this home</h2>
          <p className="listing-body">{l.description}</p>
        </section>
      )}

      {(l.flood || l.schools.length > 0) && (
        <section className="section">
          <h2 className="display h3">The honest read</h2>
          <p className="section-note" style={{ marginBottom: 26 }}>
            The things that decide whether a house is a good idea, in front of you before you write
            an offer.
          </p>

          <div className="honest-grid">
            {l.flood && (
              <div className="honest-card">
                <div className="eyebrow">FLOOD RISK</div>
                {l.flood.score !== null && (
                  <div className="flood-score">
                    <span className="flood-num">{l.flood.score}</span>
                    <span className="flood-of">/ 10 flood factor</span>
                  </div>
                )}
                {l.flood.femaZone && (
                  <p className="honest-line">
                    <strong>FEMA zone:</strong> {l.flood.femaZone}
                  </p>
                )}
                {l.flood.trend && <p className="honest-line">{l.flood.trend}</p>}
                {l.flood.insurance && <p className="honest-line muted">{l.flood.insurance}</p>}
                {l.flood.sourceUrl && (
                  <a className="arrow-link" href={l.flood.sourceUrl} target="_blank" rel="noopener noreferrer">
                    Full flood report →
                  </a>
                )}
              </div>
            )}

            {l.schools.length > 0 && (
              <div className="honest-card">
                <div className="eyebrow">SCHOOLS</div>
                <div className="school-list">
                  {l.schools.slice(0, 6).map((s) => (
                    <div className="school" key={`${s.name}-${s.grades}`}>
                      <div className="school-main">
                        <div className="school-name">{s.name}</div>
                        <div className="school-meta">
                          {[s.level, s.grades ? `grades ${s.grades}` : null, s.district]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      </div>
                      <div className="school-side">
                        {s.rating !== null && <span className="school-rating">{s.rating}/10</span>}
                        {s.distanceMiles !== null && (
                          <span className="school-dist">{s.distanceMiles} mi</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {l.history.length > 0 && (
        <section className="section">
          <h2 className="display h3">Price history</h2>
          <div className="scroller">
            <table className="history">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Event</th>
                  <th>Price</th>
                  <th>Change</th>
                </tr>
              </thead>
              <tbody>
                {l.history.map((h) => (
                  <tr key={`${h.date}-${h.label}`}>
                    <td>{h.date}</td>
                    <td>{h.label}</td>
                    <td className="num">{money(h.price) ?? "—"}</td>
                    <td className={h.change && h.change < 0 ? "num down" : "num up"}>
                      {h.change ? `${h.change > 0 ? "+" : ""}${money(h.change)}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {l.lat !== null && l.lng !== null && (
        <section className="section">
          <h2 className="display h3">Where it is</h2>
          <ListingMap lat={l.lat} lng={l.lng} label={money(l.price) ?? "This home"} />
        </section>
      )}

      <section className="section-plain">
        <h2 className="display cta-title">Want to see it?</h2>
        <p className="cta-sub">
          We&rsquo;ll walk the street, pull the tax record, and tell you what we&rsquo;d want to know
          before making an offer.
        </p>
        <Link href="/book" className="btn-cta">
          Book a call
        </Link>
        {l.sourceUrl && (
          <p className="attribution">
            Listing data via{" "}
            <a href={l.sourceUrl} target="_blank" rel="noopener noreferrer">
              the source listing
            </a>
            . Information deemed reliable but not guaranteed.
          </p>
        )}
      </section>
    </>
  );
}
