/**
 * Primary photo for a Redfin listing.
 *
 * GET /api/redfin/photo?property_id=30333769&listing_id=222974105
 *
 * Redfin's search payload carries no photo URLs — only opaque group codes, and
 * the CDN path cannot be reconstructed from them reliably (tested: every
 * plausible pattern 404s). /detailsbyid does return real URLs, so this fetches
 * that and deep-scans for the best one.
 *
 * That costs one credit per listing, so responses are cached for a week:
 * listing photos effectively never change, and the second viewer pays nothing.
 */
import { NextRequest, NextResponse } from "next/server";
import { RealtyApiError, realtyConfigured, redfinFetch } from "@/lib/realty";

export const runtime = "nodejs";

const PHOTO_TTL = 604_800; // 7 days

/**
 * Preference order. `bigphoto`/`mbpaddedwide` are full-size; the `gen*`
 * variants are generated thumbnails. We want a card-sized image, so mid beats
 * both a 2000px original and a 100px thumbnail.
 */
const RANK: Array<[RegExp, number]> = [
  [/\/mbphotov3\/.*genMid\./, 100],
  [/\/mbpaddedwide\//, 90],
  [/\/bcsphoto\/.*genBcs\./, 80],
  [/\/bigphoto\//, 70],
  [/\/tmbphoto\/.*genTmb\./, 20],
];

function scorePhoto(url: string): number {
  for (const [re, score] of RANK) if (re.test(url)) return score;
  return 10;
}

/** Collect every Redfin CDN photo URL anywhere in the payload. */
function collectPhotos(node: unknown, out: string[] = [], depth = 0): string[] {
  if (depth > 12 || out.length > 400) return out;
  if (typeof node === "string") {
    if (node.includes("cdn-redfin.com/photo") && /\.(jpg|jpeg|png|webp)$/i.test(node)) {
      out.push(node);
    }
    return out;
  }
  if (Array.isArray(node)) {
    for (const v of node) collectPhotos(v, out, depth + 1);
    return out;
  }
  if (node && typeof node === "object") {
    for (const v of Object.values(node as Record<string, unknown>)) {
      collectPhotos(v, out, depth + 1);
    }
  }
  return out;
}

export async function GET(req: NextRequest) {
  const propertyId = req.nextUrl.searchParams.get("property_id")?.trim();
  const listingId = req.nextUrl.searchParams.get("listing_id")?.trim();

  if (!propertyId || !listingId) {
    return NextResponse.json({ error: "property_id and listing_id are required" }, { status: 400 });
  }
  if (!/^\d+$/.test(propertyId) || !/^\d+$/.test(listingId)) {
    return NextResponse.json({ error: "ids must be numeric" }, { status: 400 });
  }
  if (!realtyConfigured()) return NextResponse.json({ photo: null });

  try {
    const data = await redfinFetch(
      "/detailsbyid",
      { property_id: propertyId, listing_id: listingId },
      { revalidate: PHOTO_TTL },
    );

    const photos = collectPhotos(data);
    if (!photos.length) return NextResponse.json({ photo: null });

    // Prefer a card-sized variant, and among equals the lowest-numbered frame,
    // which is the listing's lead image.
    const best = photos
      .map((url) => ({ url, score: scorePhoto(url) }))
      .sort((a, b) => b.score - a.score || a.url.localeCompare(b.url))[0];

    return NextResponse.json(
      { photo: best.url, count: photos.length },
      {
        headers: {
          "Cache-Control": `public, s-maxage=${PHOTO_TTL}, stale-while-revalidate=2592000`,
        },
      },
    );
  } catch (err) {
    if (err instanceof RealtyApiError) {
      return NextResponse.json({ photo: null, error: err.message }, { status: 200 });
    }
    return NextResponse.json({ photo: null }, { status: 200 });
  }
}
