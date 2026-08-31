import type { Metadata } from "next";
import Link from "next/link";
import { IDX, STEPS } from "@/lib/content";

export const metadata: Metadata = {
  title: "For buyers",
  description:
    "First house, third house, or one you've never seen in person. Flood zone, tax rate, HOA, and comparable sales in front of you before you write an offer.",
};

export default function BuyersPage() {
  return (
    <>
      <section className="page-intro">
        <div className="eyebrow">FOR BUYERS</div>
        <h1 className="display page-title">
          First house, third house, or one you&rsquo;ve never seen in person
        </h1>
        <p className="page-lede">
          Houston is a dozen markets wearing one name. What you can afford in Cypress buys something
          different in the Heights, and the difference is rarely the house.
        </p>
      </section>

      <section className="section">
        <div className="step-grid">
          {STEPS.map((s) => (
            <div key={s.num}>
              <div className="display step-num">{s.num}</div>
              <h3 className="step-title">{s.title}</h3>
              <p className="step-body">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="split">
        <div className="photo-block">
          <span className="slot">[ photo — clients at the closing table ]</span>
        </div>
        <div className="split-r">
          <h2 className="display h3" style={{ fontSize: 40, lineHeight: 1.06, letterSpacing: "-0.035em" }}>
            Relocating from out of state
          </h2>
          <p>
            We tour on video, walk the street, and tell you what the listing photos left out.
            Clients regularly buy here before their first visit.
          </p>
          <p>
            We&rsquo;ll also connect you with lenders, inspectors, and insurance people who
            understand Texas flood zones and property tax protests.
          </p>
          <Link
            href="/contact"
            style={{
              display: "inline-block",
              padding: "15px 28px",
              borderRadius: 26,
              background: "var(--brand)",
              color: "var(--on-brand)",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            Start a relocation call
          </Link>
        </div>
      </section>

      <section className="section-plain">
        <h2 className="display h2" style={{ marginBottom: 26 }}>
          Browse everything on the market
        </h2>
        <a
          href={`${IDX}/idx/search/advanced`}
          style={{
            display: "inline-block",
            padding: "17px 34px",
            borderRadius: 28,
            border: "1px solid var(--brand)",
            color: "var(--brand)",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Advanced search
        </a>
      </section>
    </>
  );
}
