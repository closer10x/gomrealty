import type { MetadataRoute } from "next";

const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ?? "";

/**
 * Static routes only. Listing pages are deliberately excluded: inventory turns
 * over daily, and enumerating it would mean a search call per market on every
 * crawl. Listings are reachable from the map and each carries its own canonical
 * and structured data.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes = ["", "/buyers", "/sellers", "/about", "/contact", "/book"];

  return routes.map((path) => ({
    url: `${site}${path}`,
    lastModified: now,
    changeFrequency: path === "" ? "daily" : "monthly",
    priority: path === "" ? 1 : 0.7,
  }));
}
