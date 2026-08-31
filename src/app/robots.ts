import type { MetadataRoute } from "next";

const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ?? "";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Booking pages are per-person and carry tokens; keep them out of search.
        disallow: ["/api/", "/booking/"],
      },
    ],
    sitemap: site ? `${site}/sitemap.xml` : undefined,
  };
}
