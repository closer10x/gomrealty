import Link from "next/link";
import { IDX, NAV, SITE } from "@/lib/content";

export default function SiteFooter() {
  return (
    <footer className="footer">
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div className="footer-mark" aria-hidden />
          <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.03em" }}>GO M REALTY</div>
        </div>
        <div className="footer-addr">
          {SITE.addressLines[0]}
          <br />
          {SITE.addressLines[1]}
          <br />
          <a href={SITE.phoneHref}>{SITE.phone}</a>
        </div>
      </div>

      <div>
        <div className="footer-h">SEARCH</div>
        <div className="footer-links">
          <a href={`${IDX}/idx/map/mapsearch`}>Map search</a>
          <a href={`${IDX}/idx/search/advanced`}>Advanced search</a>
          <a href={`${IDX}/idx/featured`}>Featured listings</a>
          <a href={`${IDX}/idx/market-reports`}>Market reports</a>
        </div>
      </div>

      <div>
        <div className="footer-h">COMPANY</div>
        <div className="footer-links">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      <div>
        <div className="footer-h">FOLLOW</div>
        <div className="footer-links">
          <a href={SITE.facebook}>Facebook</a>
          <a href={SITE.instagram}>Instagram</a>
          <a href={`${IDX}/idx/contact`}>Write a review</a>
        </div>
      </div>

      <div className="footer-bottom">
        <div>© 2026 Go M Realty. All information deemed reliable but not guaranteed.</div>
        <div style={{ display: "flex", gap: 20 }}>
          <span>Privacy Policy</span>
          <span>Terms of Use</span>
          <span>Equal Housing Opportunity</span>
        </div>
      </div>
    </footer>
  );
}
