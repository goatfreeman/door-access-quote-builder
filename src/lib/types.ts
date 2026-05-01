export type CatalogItem = {
  id: string;
  sku: string;
  name: string;
  category: "Camera" | "Access Control" | "Door Hardware" | "Labor" | "Network" | "Other";
  unitPrice: number;
  msrp?: number;
  vendor?: string;
  inventory?: number;
  notes?: string;
};

export type TemplateLine = {
  itemId: string;
  quantity: number;
};

export type QuoteTemplate = {
  id: string;
  name: string;
  description: string;
  lines: TemplateLine[];
};

export type QuoteLine = {
  lineId: string;
  itemId: string;
  name: string;
  sku: string;
  packageName?: string;
  quantity: number;
  unitPrice: number;
  notes: string;
};

export type QuoteMeta = {
  customer: string;
  project: string;
  email: string;
  quoteNumber: string;
  marginPercent: number;
  taxPercent: number;
  includeLabor: boolean;
};

export type SavedQuote = {
  id: string;
  createdAt: string;
  updatedAt: string;
  meta: QuoteMeta;
  lines: QuoteLine[];
  total: number;
};

export type ServiceTitanSettings = {
  baseUrl: string;
  tenantId: string;
  clientId: string;
  clientSecret: string;
  lastSyncAt?: string;
};
