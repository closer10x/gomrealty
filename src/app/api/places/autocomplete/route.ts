/**
 * Google Places autocomplete, proxied so GOOGLE_PLACES_API_KEY stays server-side.
 *
 * GET /api/places/autocomplete?input=cypre
 *
 * Biased to Greater Houston and restricted to place types a listing search can
 * actually use (cities, neighborhoods, postal codes, addresses). Returns [] when
 * the key is absent, so the search box degrades to a plain text input.
 */
import { NextRequest, NextResponse } from "next/server";
import { realtyConfigured, realtyFetch } from "@/lib/realty";

export const runtime = "nodejs";

const ENDPOINT = "https://places.googleapis.com/v1/places:autocomplete";

/** Roughly Greater Houston — biases, not restricts, the suggestions. */
const HOUSTON_CENTER = { latitude: 29.7604, longitude: -95.3698 };
const BIAS_RADIUS_M = 80_000;

export type PlaceSuggestion = {
  text: string;
  placeId: string | null;
  /** True for a specific street address rather than an area. */
  isAddress: boolean;
};

export async function GET(req: NextRequest) {
  const input = req.nextUrl.searchParams.get("input")?.trim();
  if (!input || input.length < 2) return NextResponse.json({ suggestions: [] });

  /**
   * RealtyAPI is the default source: it returns the places this site can
   * actually search, and it works today. Google is opt-in via
   * GOOGLE_PLACES_ENABLED=true, so a disabled or unbilled Places project
   * can't add a failed round trip to every keystroke.
   */
  const key = process.env.GOOGLE_PLACES_API_KEY;
  // `!key` is part of the guard so TypeScript narrows it for the fetch below.
  const googleEnabled = process.env.GOOGLE_PLACES_ENABLED === "true";
  if (!googleEnabled || !key) return realtySuggestions(input);

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "suggestions.placePrediction.text,suggestions.placePrediction.placeId,suggestions.placePrediction.types",
      },
      body: JSON.stringify({
        input,
        regionCode: process.env.GOOGLE_PLACES_REGION || "us",
        includedRegionCodes: ["us"],
        locationBias: {
          circle: { center: HOUSTON_CENTER, radius: BIAS_RADIUS_M },
        },
      }),
      // Same prefix typed twice shouldn't cost two Google calls.
      next: { revalidate: 86_400 },
    });

    if (!res.ok) {
      // 403 here usually means "Places API (New)" isn't enabled on the project.
      // Fall back rather than leaving the search box with no suggestions.
      console.warn("[places] google returned", res.status, "— falling back to RealtyAPI");
      return realtySuggestions(input);
    }

    const data = (await res.json()) as {
      suggestions?: Array<{
        placePrediction?: {
          text?: { text?: string };
          placeId?: string;
          types?: string[];
        };
      }>;
    };

    const USEFUL = new Set([
      "locality",
      "sublocality",
      "neighborhood",
      "postal_code",
      "administrative_area_level_3",
      "street_address",
      "premise",
      "subpremise",
      "route",
    ]);

    const suggestions: PlaceSuggestion[] = (data.suggestions ?? [])
      .map((s) => s.placePrediction)
      .filter((p): p is NonNullable<typeof p> => Boolean(p?.text?.text))
      .filter((p) => !p.types?.length || p.types.some((t) => USEFUL.has(t)))
      .slice(0, 6)
      .map((p) => ({
        text: p.text!.text!,
        placeId: p.placeId ?? null,
        isAddress: Boolean(
          p.types?.some((t) => ["street_address", "premise", "subpremise"].includes(t)),
        ),
      }));

    return NextResponse.json(
      { suggestions },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
    );
  } catch {
    return realtySuggestions(input);
  }
}

/**
 * Fallback source. RealtyAPI's autocomplete covers cities, ZIPs, and
 * neighborhoods — enough for a listing search. It bills a credit per call, so
 * it's cached for a day.
 */
async function realtySuggestions(input: string) {
  if (!realtyConfigured()) return NextResponse.json({ suggestions: [] });

  try {
    const data = await realtyFetch<{
      searchResults?: Array<{
        city?: string;
        state_code?: string;
        postal_code?: string;
        neighborhood?: string;
        area_type?: string;
      }>;
    }>("/autocomplete", { input, limit: 6 }, { revalidate: 86_400 });

    const suggestions = (data.searchResults ?? [])
      .map((r) => {
        const label =
          r.area_type === "postal_code" && r.postal_code
            ? r.postal_code
            : [r.neighborhood ?? r.city, r.state_code].filter(Boolean).join(", ");
        return label ? { text: label, placeId: null, isAddress: r.area_type === "address" } : null;
      })
      .filter((s): s is { text: string; placeId: null; isAddress: boolean } => s !== null)
      // Distinct labels only — the upstream repeats cities across area types.
      .filter((s, i, arr) => arr.findIndex((o) => o.text === s.text) === i);

    // This is a Houston brokerage: "Sugar Hill, GA" is noise next to
    // "Sugar Land, TX". Texas first, everything else after.
    const ranked = [
      ...suggestions.filter((s) => /,\s*TX$/.test(s.text) || /^\d{5}$/.test(s.text)),
      ...suggestions.filter((s) => !(/,\s*TX$/.test(s.text) || /^\d{5}$/.test(s.text))),
    ].slice(0, 6);

    return NextResponse.json(
      { suggestions: ranked, source: "realtyapi" },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
    );
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
