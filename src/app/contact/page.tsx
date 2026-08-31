import type { Metadata } from "next";
import LeadForm from "@/components/LeadForm";
import { SITE } from "@/lib/content";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Tell us where you are in the process — just starting to look, under contract elsewhere, or deciding whether to sell first. Go M Realty, Houston TX.",
};

export default function ContactPage() {
  return (
    <section className="split contact-split" style={{ minHeight: 620, borderBottom: "none" }}>
      <div className="split-l tall">
        <div className="eyebrow">CONTACT</div>
        <h1 className="display page-title" style={{ fontSize: 52, lineHeight: 1.04 }}>
          Tell us where you are in the process
        </h1>
        <p style={{ fontSize: 17, lineHeight: 1.58, color: "var(--ink-body)", margin: "0 0 42px", maxWidth: "44ch" }}>
          Just starting to look, under contract elsewhere, or deciding whether to sell first. All of
          it is a normal place to begin.
        </p>
        <div style={{ display: "grid", gap: 22, fontSize: "15.5px", lineHeight: 1.6 }}>
          <div>
            <div className="footer-h" style={{ letterSpacing: "0.18em", marginBottom: 6 }}>OFFICE</div>
            <div>
              {SITE.addressLines[0]}
              <br />
              {SITE.addressLines[1]}
            </div>
          </div>
          <div>
            <div className="footer-h" style={{ letterSpacing: "0.18em", marginBottom: 6 }}>PHONE</div>
            <a href={SITE.phoneHref}>{SITE.phone}</a>
          </div>
          <div>
            <div className="footer-h" style={{ letterSpacing: "0.18em", marginBottom: 6 }}>HOURS</div>
            <div>{SITE.hours}</div>
          </div>
        </div>
      </div>

      <div className="contact-panel">
        <LeadForm kind="contact" />
      </div>
    </section>
  );
}
