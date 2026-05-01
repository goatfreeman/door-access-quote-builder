import { itemDatabase } from "../data/item-database";
import type { QuoteTemplate } from "./types";

export const seedItems = itemDatabase;

export const seedTemplates: QuoteTemplate[] = [
  {
    id: "one-door",
    name: "One Door Setup",
    description: "Single access-controlled opening with reader, strike, REX, contact, and labor.",
    lines: [
      { itemId: "honeywell-reader", quantity: 1 },
      { itemId: "assa-9600", quantity: 1 },
      { itemId: "rex-motion", quantity: 1 },
      { itemId: "door-contact", quantity: 1 },
      { itemId: "labor-install", quantity: 6 },
      { itemId: "labor-program", quantity: 2 },
    ],
  },
  {
    id: "two-door",
    name: "Two Door Setup",
    description: "Two doors sharing panel hardware with door devices and labor.",
    lines: [
      { itemId: "honeywell-pro4200", quantity: 1 },
      { itemId: "honeywell-reader", quantity: 2 },
      { itemId: "assa-9600", quantity: 2 },
      { itemId: "rex-motion", quantity: 2 },
      { itemId: "door-contact", quantity: 2 },
      { itemId: "labor-install", quantity: 12 },
      { itemId: "labor-program", quantity: 3 },
    ],
  },
  {
    id: "site-starter",
    name: "Whole Site Starter",
    description: "Access panel, cameras, switching, doors, and commissioning for a small site.",
    lines: [
      { itemId: "honeywell-pro4200", quantity: 1 },
      { itemId: "axis-p3265", quantity: 4 },
      { itemId: "poe-switch", quantity: 1 },
      { itemId: "honeywell-reader", quantity: 4 },
      { itemId: "assa-9600", quantity: 4 },
      { itemId: "labor-install", quantity: 28 },
      { itemId: "labor-program", quantity: 6 },
    ],
  },
];
