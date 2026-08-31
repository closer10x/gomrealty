/**
 * Image variant helpers. Deliberately NOT in lib/realty.ts — that module is
 * `server-only`, and the gallery, map popup and result list are all client
 * components.
 *
 * Realtor's CDN encodes the variant as a suffix on the filename, and the API
 * hands out `s`, which is 120x80. Rendered in a 1140px frame that is a 9x
 * upscale, which is why every photo looked soft. Measured ladder:
 *
 *   s 120x80 · t 140x105 · l 300x200 · m 310x233 · x 460x307
 *   od 1024x682 · rd 2048x1365
 */

export type RdcSize = "t" | "l" | "m" | "x" | "od" | "rd";

/** `…-f2082720429s.jpg` → captures the digits and the trailing size code. */
const RDC_SUFFIX = /-([a-z])?(\d+)(?:s|t|l|m|x|od|rd|w)?\.jpg$/i;

/** Rewrites an rdcpix URL to a given variant. Anything else passes through. */
export function rdcpix(url: string | null | undefined, size: RdcSize): string | null {
  if (!url) return null;
  if (!url.includes("rdcpix.com")) return url;
  return url.replace(RDC_SUFFIX, (_m, letter: string | undefined, digits: string) =>
    `-${letter ?? ""}${digits}${size}.jpg`,
  );
}

/** Two-variant `srcset`, so the browser picks by viewport width and density. */
export function rdcpixSrcSet(url: string | null | undefined): string | undefined {
  if (!url || !url.includes("rdcpix.com")) return undefined;
  const od = rdcpix(url, "od");
  const rd = rdcpix(url, "rd");
  return od && rd ? `${od} 1024w, ${rd} 2048w` : undefined;
}
