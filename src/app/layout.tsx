import type { Metadata } from "next";
import { Archivo, Schibsted_Grotesk } from "next/font/google";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-archivo",
  display: "swap",
});

const schibsted = Schibsted_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-schibsted",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3200"),
  title: {
    default: "Go M Realty — Greater Houston real estate",
    template: "%s · Go M Realty",
  },
  description:
    "Every active listing across Greater Houston, with an honest read on the neighborhood behind each pin. Buying, selling, and relocation across Houston, The Woodlands, Sugar Land, Cypress, and Katy.",
  openGraph: {
    title: "Go M Realty — Greater Houston real estate",
    description:
      "Start with the map, not the brochure. Every active listing across Greater Houston.",
    type: "website",
    locale: "en_US",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${schibsted.variable}`}>
      <body>
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
