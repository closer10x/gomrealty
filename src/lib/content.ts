/** Copy from the design comp, kept in one place so pages stay presentational. */

export const IDX = "https://go-mrealty.idxbroker.com";

export const SITE = {
  name: "Go M Realty",
  region: "GREATER HOUSTON",
  phone: "832.514.7301",
  phoneHref: "tel:8325147301",
  addressLines: ["1334 Brittmoore Rd, Ste 2309", "Houston, TX 77043"],
  hours: "Showings seven days a week, 8am – 8pm",
  facebook: "https://www.facebook.com/GoMRealty",
  instagram: "https://www.instagram.com/gom_realty/",
};

export const NAV = [
  { href: "/buyers", label: "Buyers" },
  { href: "/sellers", label: "Sellers" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export const FILTERS = ["For sale", "Under $500K", "4+ beds", "New build"];

/** Filter chip -> RealtyAPI query params. */
export const FILTER_QUERY: Record<string, Record<string, string>> = {
  "For sale": { searchType: "For_Sale" },
  "Under $500K": { searchType: "For_Sale", priceRange: "max:500000" },
  "4+ beds": { searchType: "For_Sale", bedsRange: "min:4" },
  "New build": { searchType: "For_Sale", newConstruction: "true" },
};

export const STATS = [
  { value: "18 yrs", label: "Working the Greater Houston market" },
  { value: "5", label: "Core markets we know street by street" },
  { value: "24 hrs", label: "Typical response time on a new inquiry" },
  { value: "100%", label: "Of clients work with an agent, not an assistant" },
];

export const AREAS = [
  { name: "Houston", note: "Inner Loop to the Energy Corridor", count: "1,840 homes", slot: "[ Houston ]", href: `${IDX}/i/Houston` },
  { name: "The Woodlands", note: "Master-planned, heavily wooded", count: "412 homes", slot: "[ The Woodlands ]", href: `${IDX}/i/The-Woodlands-TX` },
  { name: "Sugar Land", note: "Established suburbs, strong schools", count: "306 homes", slot: "[ Sugar Land ]", href: `${IDX}/i/Sugar-Land-TX` },
  { name: "Cypress", note: "New construction, room to grow", count: "588 homes", slot: "[ Cypress ]", href: `${IDX}/i/Cypress-TX` },
  { name: "Katy", note: "Family-first, west side commute", count: "674 homes", slot: "[ Katy ]", href: `${IDX}/i/Katy` },
];

/**
 * Sofi Lakes — the Katy master-planned community we represent. Figures are from
 * sofilakes.com; update them here when sections sell through or pricing moves.
 */
export const SOFI_LAKES = {
  name: "Sofi Lakes",
  place: "Katy, TX \u00b7 Waller County",
  href: "https://sofilakes.com",
  builders: ["Lennar", "Coventry Homes", "Westin Homes", "Chesmar Homes", "Imagination Homes"],
  amenities: "Resort pools with cabanas, pickleball, playgrounds, an open-air fitness area, and lakes.",
  /* Community marketing photos, downscaled from sofilakes.com/gallery. */
  photos: [
    { src: "/sofi-lakes/photo-entrance.jpg", alt: "The Sofi Lakes community entrance" },
    { src: "/sofi-lakes/photo-model-coventry.jpg", alt: "A Coventry Homes model at Sofi Lakes" },
  ],
  facts: [
    { value: "390", label: "Homesites across two sections" },
    { value: "$240K\u2013$700K", label: "1,400\u20136,000 sqft, 3\u20136 bd" },
    { value: "150 acres", label: "Green space, 5+ miles of trail" },
    { value: "24", label: "Homes that actually touch water" },
  ],
};

export const REVIEWS = [
  { quote: "We bought from Colorado without setting foot in the house. Every question got a straight answer, including the ones that talked us out of two other places.", name: "THE FERRELLS · KATY" },
  { quote: "Listed Thursday, three offers by Monday. The pricing conversation up front was the whole thing.", name: "D. OKONKWO · SUGAR LAND" },
  { quote: "First-time buyers, so we needed everything explained twice. Nobody made us feel like that was a problem.", name: "ANA & RUBEN · HOUSTON" },
];

export const STEPS = [
  { num: "01", title: "Get your number", body: "A lender pre-approval before we tour, so your offer is taken seriously the first time." },
  { num: "02", title: "Narrow the map", body: "We work through commute, schools, flood zone, and tax rate until the search area is honest." },
  { num: "03", title: "Tour and compare", body: "We show you what is wrong with each house, not just what is right." },
  { num: "04", title: "Offer and close", body: "Terms, option period, repairs, and a closing date that fits your lease or your sale." },
];

export const SELL_POINTS = [
  { title: "A real comparative market analysis", body: "Closed sales, active competition, and what buyers in your price band are choosing instead." },
  { title: "Prep that pays for itself", body: "We tell you which repairs return money and which ones do not. Usually a short list." },
  { title: "Photography and launch timing", body: "Professional photos, floor plan, and a launch day chosen for traffic, not convenience." },
];

export const MARKETING = [
  { title: "Exposure", body: "Full MLS syndication, social campaigns, and direct outreach to agents already working your price band." },
  { title: "Showing management", body: "Scheduled, confirmed, and followed up on. You get feedback, not silence." },
  { title: "Negotiation", body: "Offers compared side by side on price, financing, and risk of falling through, not just the top number." },
];

export const TEAM = [
  { name: "Name Here", role: "BROKER · OWNER", bio: "Leads the brokerage and works listings across northwest Houston.", slot: "[ headshot ]" },
  { name: "Name Here", role: "BUYER SPECIALIST", bio: "Handles relocation and first-time buyers from search to closing.", slot: "[ headshot ]" },
  { name: "Name Here", role: "LISTING SPECIALIST", bio: "Pricing, prep, and marketing for sellers in Katy and Cypress.", slot: "[ headshot ]" },
  { name: "Name Here", role: "CLIENT CARE", bio: "Keeps showings, paperwork, and closing timelines on track.", slot: "[ headshot ]" },
];

export const VALUES = [
  { title: "Straight answers", body: "If a house is a bad idea, we say so. It costs us a commission occasionally and it has never cost us a client." },
  { title: "One point of contact", body: "The agent you meet is the agent who runs your transaction start to finish." },
  { title: "Local, not regional", body: "We turn down business outside the metro rather than pretend to know a market we do not." },
];

export const INTENTS = ["Buying", "Selling", "Both", "Relocating"] as const;
export type Intent = (typeof INTENTS)[number];
