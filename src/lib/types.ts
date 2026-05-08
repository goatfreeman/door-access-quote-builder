export type CatalogItem = {
  id: string;
  sku: string;
  name: string;
  category: string;
  unitPrice: number;
  msrp?: number;
  vendor?: string;
  inventory?: number;
  notes?: string;
  deletedAt?: string;
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
  location?: string;
  email: string;
  quoteNumber: string;
  marginPercent: number;
  taxPercent: number;
  includeLabor: boolean;
  laborHours?: number;
  laborRate?: number;
};

export type SavedQuote = {
  id: string;
  shareToken?: string;
  createdAt: string;
  updatedAt: string;
  meta: QuoteMeta;
  lines: QuoteLine[];
  total: number;
  deletedAt?: string;
};

export type ServiceTitanSettings = {
  baseUrl: string;
  tenantId: string;
  clientId: string;
  clientSecret: string;
  adiBaseUrl?: string;
  adiAccountNumber?: string;
  adiApiKey?: string;
  lastSyncAt?: string;
};
