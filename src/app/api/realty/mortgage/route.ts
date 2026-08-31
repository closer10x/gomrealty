import { NextRequest, NextResponse } from "next/server";
import { RealtyApiError, realtyFetch } from "@/lib/realty";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const price = Number(sp.get("price"));
  if (!Number.isFinite(price) || price <= 0) {
    return NextResponse.json({ error: "`price` is required" }, { status: 400 });
  }

  const query: Record<string, string | number> = { price };
  for (const k of ["downPayment", "rate", "term", "propertyTaxRate", "hoaFees", "homeInsurance"]) {
    const v = sp.get(k);
    if (v && Number.isFinite(Number(v))) query[k] = Number(v);
  }
  if (sp.get("applyVeteransBenefits") === "true") query.applyVeteransBenefits = "true";

  try {
    const data = await realtyFetch("/mortgage", query, { revalidate: 3600 });
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof RealtyApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Upstream request failed" }, { status: 502 });
  }
}
