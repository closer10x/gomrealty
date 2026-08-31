import type { Listing } from "./realty";

/** Map pin positions, reused when live listings have no usable coordinates. */
export const PIN_POSITIONS = [
  { left: "19%", top: "30%" },
  { left: "46%", top: "20%" },
  { left: "72%", top: "36%" },
  { left: "30%", top: "56%" },
  { left: "58%", top: "64%" },
  { left: "82%", top: "16%" },
  { left: "40%", top: "44%" },
] as const;

/**
 * The seven listings from the design comp. Used when REALTYAPI_KEY is not set
 * or the upstream call fails, so the homepage never renders an empty map.
 */
export const SAMPLE_LISTINGS: Listing[] = [
  {
    id: "sample-1", price: 489000, priceShort: "$489K", priceFull: "$489,000",
    beds: 4, baths: 3, sqft: 2940, specs: "4 bd · 3 ba · 2,940 sqft",
    address: "14219 Cypress Falls Dr, Cypress", city: "Cypress",
    status: "New", photo: null, lat: null, lng: null, href: null,
  },
  {
    id: "sample-2", price: 725000, priceShort: "$725K", priceFull: "$725,000",
    beds: 4, baths: 3.5, sqft: 3410, specs: "4 bd · 3.5 ba · 3,410 sqft · pool",
    address: "3106 Wickersham Ln, Houston", city: "Houston",
    status: "Open Sat", photo: null, lat: null, lng: null, href: null,
  },
  {
    id: "sample-3", price: 1250000, priceShort: "$1.25M", priceFull: "$1,250,000",
    beds: 5, baths: 4.5, sqft: 4880, specs: "5 bd · 4.5 ba · 4,880 sqft",
    address: "27 N Ripple Creek, The Woodlands", city: "The Woodlands",
    status: "Featured", photo: null, lat: null, lng: null, href: null,
  },
  {
    id: "sample-4", price: 362000, priceShort: "$362K", priceFull: "$362,000",
    beds: 3, baths: 2, sqft: 1860, specs: "3 bd · 2 ba · 1,860 sqft",
    address: "2411 Fallbrook Way, Katy", city: "Katy",
    status: "New", photo: null, lat: null, lng: null, href: null,
  },
  {
    id: "sample-5", price: 598000, priceShort: "$598K", priceFull: "$598,000",
    beds: 4, baths: 3, sqft: 3120, specs: "4 bd · 3 ba · 3,120 sqft · lake lot",
    address: "8802 Riverstone Blvd, Sugar Land", city: "Sugar Land",
    status: "Active", photo: null, lat: null, lng: null, href: null,
  },
  {
    id: "sample-6", price: 845000, priceShort: "$845K", priceFull: "$845,000",
    beds: 4, baths: 3.5, sqft: 3640, specs: "4 bd · 3.5 ba · 3,640 sqft",
    address: "119 Shadowpoint Dr, The Woodlands", city: "The Woodlands",
    status: "Active", photo: null, lat: null, lng: null, href: null,
  },
  {
    id: "sample-7", price: 415000, priceShort: "$415K", priceFull: "$415,000",
    beds: 3, baths: 2.5, sqft: 2210, specs: "3 bd · 2.5 ba · 2,210 sqft",
    address: "5507 Timber Knoll Ct, Houston", city: "Houston",
    status: "Active", photo: null, lat: null, lng: null, href: null,
  },
];
