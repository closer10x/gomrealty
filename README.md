# Go M Realty

Greater Houston real estate site. Next.js 15 (App Router) port of the Claude Design
comp `Go M Realty Home v2.dc.html`, with live MLS data from RealtyAPI and lead
capture into Supabase.

## Running it

```bash
npm install
cp .env.example .env.local   # then fill in the keys
npm run dev                  # http://localhost:3200
```

The site renders correctly with **no keys at all** — the map falls back to the seven
sample listings from the design comp and says so in the corner badge, and the forms
accept submissions and log them server-side instead of persisting. Add keys to turn
on live data and storage.

## Environment

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | for leads | `https://cyexunowpxuflcmtpxbn.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | for leads | Publishable key. Safe in the browser. |
| `SUPABASE_SERVICE_ROLE_KEY` | for leads | **Server only.** Bypasses RLS. |
| `REALTYAPI_KEY` | for live MLS | **Server only.** Sent as `x-realtyapi-key`. |
| `REALTYAPI_BASE_URL` | no | Defaults to `https://realtor.realtyapi.io`. |
| `NEXT_PUBLIC_DEFAULT_LOCATION` | no | Market the homepage map opens on. |

Neither the RealtyAPI key nor the service-role key is ever sent to the browser —
`src/lib/realty.ts` and `src/lib/supabase/server.ts` both import `server-only`, so a
stray client import becomes a build error rather than a leaked credential.

## The RealtyAPI layer

`src/lib/realty.ts` wraps [realtor.realtyapi.io](https://realtor.realtyapi.io/openapi.json)
and every call is proxied so the key stays server-side.

| Route | Purpose |
| --- | --- |
| `GET /api/realty/search` | Normalised listing search used by the homepage map. Falls back to sample inventory on 401/402/network failure so a billing problem never blanks the page. |
| `GET /api/realty/autocomplete` | City / ZIP / neighborhood suggestions. Cached 1h. |
| `GET /api/realty/mortgage` | Payment breakdown for a price. |
| `GET /api/realty/<endpoint>` | Passthrough to any allowlisted upstream endpoint. Nested paths use a dash: `/api/realty/agent-for_sale` → `/agent/for_sale`. Anything off the allowlist is a 404. |

Upstream responses are untyped and Realtor.com has moved its result array around
between shapes, so `extractResults()` probes the known locations rather than
assuming one, and `normalizeListing()` is defensive about every field.

Listing search is billed per credit, so responses are cached (`s-maxage=300`).

### MCP

`.mcp.json` registers the RealtyAPI MCP server for agent use:

```bash
claude mcp add --transport http realtyapi https://mcp.realtyapi.io/mcp
```

## Supabase

`supabase/migrations/0001_leads.sql` creates the `leads` table.

RLS is on and **no anon policies are granted** — `/api/leads` writes with the
service-role key instead. That keeps the table unreadable and unwritable from the
browser even though the anon key ships to the client. The route validates input,
carries a honeypot field, and stores a salted-truncated hash of the IP rather than
the address itself.

Apply it with `supabase db push`, or paste it into the SQL editor.

## Layout notes

The source comp is desktop-only — fixed 500px map offsets, 4- and 5-column grids.
The breakpoints in `globals.css` (1180 / 900 / 560) are additions, not part of the
original design. On mobile the hero unstacks: the map becomes a 300px strip, the
search panel drops below it in normal flow, and the nav collapses to a sheet.

Colours are the comp's original `oklch()` values, lifted verbatim into custom
properties at the top of `globals.css`. Nothing was re-eyeballed.

Two fixes were applied on the way over:
- the About card `<div>` was never closed in the comp
- page-level layout used inline `grid-template-columns`, which outranks media
  queries and pinned `/sellers` and `/contact` to two columns on phones

`design-src/` holds the original export for reference. `support.js` is the Claude
Design canvas runtime (`<x-dc>`, `<sc-for>`, `<sc-if>`) and is not used at runtime —
those constructs were translated to real React.
