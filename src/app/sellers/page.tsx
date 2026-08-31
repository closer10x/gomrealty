import type { Metadata } from "next";
import LeadForm from "@/components/LeadForm";
import { MARKETING, SELL_POINTS } from "@/lib/content";

export const metadata: Metadata = {
  title: "For sellers",
  description:
    "What is your house worth this month? A real comparative market analysis from what actually closed on your street — not an automated estimate.",
};

export default function SellersPage() {
  return (
    <>
      <section className="split split-sellers">
        <div className="split-l tall">
          <div className="eyebrow">FOR SELLERS</div>
          <h1 className="display page-title" style={{ fontSize: 56 }}>
            What is your house worth this month?
          </h1>
          <p style={{ fontSize: "17.5px", lineHeight: 1.58, color: "var(--ink-body)", margin: "0 0 32px", maxWidth: "48ch" }}>
            Not an automated estimate. We look at what actually closed on your street, what is
            sitting unsold, and what that means for your list price.
          </p>
          <div className="sell-points">
            {SELL_POINTS.map((p) => (
              <div className="sell-point" key={p.title}>
                <span className="sell-dot" aria-hidden />
                <div>
                  <div className="sell-title">{p.title}</div>
                  <div className="sell-body">{p.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="valuation-panel">
          <div style={{ maxWidth: 440 }}>
            <h2 className="display" style={{ fontSize: 30, letterSpacing: "-0.03em", margin: "0 0 8px" }}>
              Request a valuation
            </h2>
            <p style={{ fontSize: "14.5px", lineHeight: 1.55, color: "var(--ink-muted)", margin: "0 0 26px" }}>
              We&rsquo;ll send a written estimate within two business days.
            </p>
            <LeadForm kind="valuation" variant="valuation" />
          </div>
        </div>
      </section>

      <section className="section" style={{ borderBottom: "none", padding: "88px var(--gutter)" }}>
        <div className="card-grid-3">
          {MARKETING.map((m) => (
            <div className="quote-card" key={m.title}>
              <h3 className="display" style={{ fontSize: 26, letterSpacing: "-0.03em", margin: "0 0 12px" }}>
                {m.title}
              </h3>
              <p style={{ fontSize: 15, lineHeight: 1.6, color: "var(--ink-muted)", margin: 0 }}>
                {m.body}
              </p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
