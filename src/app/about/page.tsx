import type { Metadata } from "next";
import { TEAM, VALUES } from "@/lib/content";

export const metadata: Metadata = {
  title: "About",
  description:
    "Go M Realty is a small brokerage based in northwest Houston. The person you meet is the person who shows you houses, writes your offer, and sits at your closing.",
};

export default function AboutPage() {
  return (
    <>
      <section className="page-intro" style={{ maxWidth: 940 }}>
        <div className="eyebrow">ABOUT</div>
        {/* The comp left this card unclosed; closed here. */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line-soft)",
            borderRadius: 18,
            padding: "22px 24px 20px",
            boxShadow: "var(--shadow-md)",
          }}
        >
          <h1 className="display page-title" style={{ fontSize: 58 }}>
            A small team, on purpose
          </h1>
          <p className="page-lede" style={{ maxWidth: "54ch" }}>
            Go M Realty is based in northwest Houston and works across the metro. We keep the roster
            small, so the person you meet is the person who shows you houses, writes your offer, and
            sits at your closing.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="team-grid">
          {TEAM.map((t, i) => (
            <div key={`${t.role}-${i}`}>
              <div className="team-photo">
                <span className="slot">{t.slot}</span>
              </div>
              <div className="team-name">{t.name}</div>
              <div className="team-role">{t.role}</div>
              <div className="team-bio">{t.bio}</div>
            </div>
          ))}
        </div>
      </section>

      <section
        className="section"
        style={{ background: "var(--surface-about)", color: "var(--ink-strong)", borderBottom: "none" }}
      >
        <h2 className="display h2" style={{ fontSize: 46, marginBottom: 40 }}>
          How we work
        </h2>
        <div className="card-grid-3" style={{ gap: 36 }}>
          {VALUES.map((v) => (
            <div key={v.title}>
              <h3 style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em", margin: "0 0 11px", color: "var(--brand-soft)" }}>
                {v.title}
              </h3>
              <p style={{ fontSize: "15.5px", lineHeight: 1.6, color: "var(--ink-muted)", margin: 0 }}>
                {v.body}
              </p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
