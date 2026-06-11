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
  createdBy?: string;
  createdByName?: string;
  updatedBy?: string;
  updatedByName?: string;
  collaborators?: string[];
};

export type QuoteLine = {
  lineId: string;
  itemId: string;
  name: string;
  sku: string;
  packageId?: string;
  packageName?: string;
  packageNickname?: string;
  packageSourceName?: string;
  quantity: number;
  unitPrice: number;
  markupMode?: "percent" | "price";
  markupPercent?: number;
  markupPrice?: number;
  msrp?: number;
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
  scopeOfWork?: string;
  notes?: string;
};

export type QuoteRevision = {
  id: string;
  savedAt: string;
  meta: QuoteMeta;
  lines: QuoteLine[];
  total: number;
  editedBy?: string;
  editedByName?: string;
};

export type SavedQuote = {
  id: string;
  shareToken?: string;
  createdAt: string;
  updatedAt: string;
  meta: QuoteMeta;
  lines: QuoteLine[];
  total: number;
  revisions?: QuoteRevision[];
  updatedBy?: string;
  updatedByName?: string;
  deletedAt?: string;
};

export type DraftQuote = {
  id: string;
  owner: string;
  ownerName?: string;
  deviceId?: string;
  deviceName?: string;
  kind?: "current" | "saved";
  quoteStep?: "pick" | "customize" | "review" | "finalize";
  createdAt: string;
  updatedAt: string;
  meta: QuoteMeta;
  lines: QuoteLine[];
  total: number;
};

export type UserSessionRecord = {
  id: string;
  userId: string;
  userName: string;
  deviceId: string;
  deviceName: string;
  createdAt: string;
  lastSeenAt: string;
  endedAt?: string;
};

export type DebugLogEntry = {
  id: string;
  type: "auth" | "session" | "sync" | "database" | "ui";
  level: "info" | "warning" | "error";
  message: string;
  userId?: string;
  userName?: string;
  deviceId?: string;
  deviceName?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type ServiceTitanSettings = {
  lastSyncAt?: string;
  taxState?: string;
  defaultTaxPercent?: number;
};
