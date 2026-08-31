"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser client, anon key only. There are no RLS policies granting anon
 * access to `leads`, so this is here for future authed features (saved
 * searches, agent login) rather than for writing leads.
 */
export function supabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}
