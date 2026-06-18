import type { CatalogItem, DebugLogEntry, DraftQuote, ExportColumnKey, QuoteMeta, QuoteRevision, QuoteTemplate, SavedQuote, ServiceTitanSettings, TemplateCategoryRequirement, UserSessionRecord } from "@/lib/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/schema-types";

export type StoreCollection = "items" | "templates" | "quotes" | "settings" | "drafts" | "sessions" | "debugLogs";
type SupabaseClient = {
  from: (tableName: string) => any;
};
type DbRow = Record<string, any>;
type ProfileMap = Map<string, { name?: string; email?: string }>;

const collections = new Set<StoreCollection>(["items", "templates", "quotes", "settings", "drafts", "sessions", "debugLogs"]);
const nilUuid = "00000000-0000-0000-0000-000000000000";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const exportColumnKeys: ExportColumnKey[] = ["item", "sku", "package", "quantity", "adiMsrp", "baseUnitPrice", "markupMode", "markupPercent", "markupPrice", "sellUnitPrice", "lineTotal", "notes"];
const templateMetadataPrefix = "\n\nQQB_TEMPLATE_META:";

export function isCollection(value: string): value is StoreCollection {
  return collections.has(value as StoreCollection);
}

export function getStoreStatus() {
  if (isSupabaseStoreEnabled()) {
    return {
      provider: "Supabase PostgreSQL",
      persistent: true,
    };
  }

  return {
    provider: "Not configured",
    persistent: false,
  };
}

export async function readCollection(collection: StoreCollection) {
  if (!isSupabaseStoreEnabled()) throw new Error("Supabase is not configured");
  return readSupabaseCollection(collection);
}

export async function writeCollection(collection: StoreCollection, value: unknown) {
  if (!isSupabaseStoreEnabled()) throw new Error("Supabase is not configured");
  await writeSupabaseCollection(collection, value);
}

async function readSupabaseCollection(collection: StoreCollection) {
  const supabase = getSupabaseClient();
  if (collection === "items") return readSupabaseItems(supabase);
  if (collection === "templates") return readSupabaseTemplates(supabase);
  if (collection === "quotes") return readSupabaseQuotes(supabase);
  if (collection === "drafts") return readSupabaseDrafts(supabase);
  if (collection === "sessions") return readSupabaseSessions(supabase);
  if (collection === "debugLogs") return readSupabaseDebugLogs(supabase);
  return readSupabaseSettings(supabase);
}

async function writeSupabaseCollection(collection: StoreCollection, value: unknown) {
  const supabase = getSupabaseClient();
  if (collection === "items") return writeSupabaseItems(supabase, asArray<CatalogItem>(value));
  if (collection === "templates") return writeSupabaseTemplates(supabase, asArray<QuoteTemplate>(value));
  if (collection === "quotes") return writeSupabaseQuotes(supabase, asArray<SavedQuote>(value));
  if (collection === "drafts") return writeSupabaseDrafts(supabase, asArray<DraftQuote>(value).filter((draft) => draft.lines.length > 0));
  if (collection === "sessions") return writeSupabaseSessions(supabase, asArray<UserSessionRecord>(value));
  if (collection === "debugLogs") return writeSupabaseDebugLogs(supabase, asArray<DebugLogEntry>(value));
  return writeSupabaseSettings(supabase, isObject(value) ? ({ ...emptySettings(), ...value } as ServiceTitanSettings) : emptySettings());
}

async function readSupabaseItems(supabase: SupabaseClient): Promise<CatalogItem[]> {
  const { data, error } = await supabase.from("catalog_items").select("*").order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as DbRow[]).map((row: DbRow) => ({
    id: appId("item", row.id),
    sku: row.sku,
    name: row.name,
    category: row.category,
    unitPrice: Number(row.unit_price ?? 0),
    msrp: nullableNumber(row.msrp),
    vendor: row.vendor ?? undefined,
    inventory: nullableNumber(row.inventory),
    notes: row.notes ?? undefined,
    deletedAt: row.deleted_at ?? undefined,
  }));
}

async function writeSupabaseItems(supabase: SupabaseClient, items: CatalogItem[]) {
  await deleteMissingUuidRows(supabase, "catalog_items", items.map((item) => dbUuid(item.id, "item")).filter(isUuid));
  if (!items.length) return;

  const { error } = await supabase.from("catalog_items").upsert(
    items.map((item) => ({
      id: dbUuid(item.id, "item"),
      sku: item.sku ?? "",
      name: item.name || "Unnamed item",
      category: item.category || "Uncategorized",
      unit_price: item.unitPrice ?? 0,
      msrp: item.msrp ?? null,
      vendor: item.vendor ?? null,
      inventory: item.inventory ?? null,
      notes: item.notes ?? null,
      deleted_at: item.deletedAt ?? null,
    })),
  );
  if (error) throw new Error(error.message);
}

async function readSupabaseTemplates(supabase: SupabaseClient): Promise<QuoteTemplate[]> {
  const [templatesResult, profiles] = await Promise.all([
    supabase.from("quote_templates").select("*").order("updated_at", { ascending: false }),
    readProfiles(supabase),
  ]);
  if (templatesResult.error) throw new Error(templatesResult.error.message);

  return ((templatesResult.data ?? []) as DbRow[]).map((template: DbRow) => {
    const metadata = parseTemplateDescription(template.description ?? "");
    return {
      id: appId("template", template.id),
      name: template.name,
      description: metadata.description,
      lines: [],
      categoryRequirements: metadata.categoryRequirements,
      createdBy: template.created_by ?? undefined,
      createdByName: displayName(profiles, template.created_by),
      updatedBy: template.updated_by ?? undefined,
      updatedByName: displayName(profiles, template.updated_by),
      collaborators: template.collaborators ?? [],
    };
  });
}

async function writeSupabaseTemplates(supabase: SupabaseClient, templates: QuoteTemplate[]) {
  const templateIds = templates.map((template) => dbUuid(template.id, "template")).filter(isUuid);
  await deleteMissingUuidRows(supabase, "quote_templates", templateIds);
  await deleteAllRows(supabase, "template_lines");
  if (!templates.length) return;

  const { error: templateError } = await supabase.from("quote_templates").upsert(
    templates.map((template) => ({
      id: dbUuid(template.id, "template"),
      name: template.name || "Untitled template",
      description: serializeTemplateDescription(template),
      created_by: nullableUuid(template.createdBy),
      updated_by: nullableUuid(template.updatedBy),
      collaborators: (template.collaborators ?? []).filter(isUuid),
      deleted_at: null,
    })),
  );
  if (templateError) throw new Error(templateError.message);
}

async function readSupabaseQuotes(supabase: SupabaseClient): Promise<SavedQuote[]> {
  const [quotesResult, revisionsResult, profiles] = await Promise.all([
    supabase.from("quotes").select("*").order("updated_at", { ascending: false }),
    supabase.from("quote_revisions").select("*").order("revision", { ascending: false }),
    readProfiles(supabase),
  ]);
  if (quotesResult.error) throw new Error(quotesResult.error.message);
  if (revisionsResult.error) throw new Error(revisionsResult.error.message);

  const revisionsByQuote = new Map<string, QuoteRevision[]>();
  for (const revision of (revisionsResult.data ?? []) as DbRow[]) {
    const current = revisionsByQuote.get(revision.quote_id) ?? [];
    current.push({
      id: appId("revision", revision.id),
      savedAt: revision.created_at,
      meta: asMeta(revision.meta_snapshot),
      lines: asQuoteLines(revision.lines_snapshot),
      total: Number(revision.total ?? 0),
      editedBy: revision.changed_by ?? undefined,
      editedByName: displayName(profiles, revision.changed_by),
    });
    revisionsByQuote.set(revision.quote_id, current);
  }

  return ((quotesResult.data ?? []) as DbRow[]).map((quote: DbRow) => ({
    id: appId("quote", quote.id),
    shareToken: appId("share", quote.share_token),
    createdAt: quote.created_at,
    updatedAt: quote.updated_at,
    meta: {
      customer: quote.customer,
      project: quote.project,
      location: quote.location ?? "",
      email: quote.email ?? "",
      quoteNumber: quote.quote_number,
      marginPercent: Number(quote.margin_percent ?? 0),
      taxPercent: Number(quote.tax_percent ?? 0),
      includeLabor: Boolean(quote.include_labor),
      laborHours: nullableNumber(quote.labor_hours),
      laborRate: nullableNumber(quote.labor_rate),
      scopeOfWork: quote.scope_of_work ?? "",
      notes: quote.notes ?? "",
    },
    lines: asQuoteLines(quote.lines_snapshot),
    total: Number(quote.total ?? 0),
    revisions: revisionsByQuote.get(quote.id) ?? [],
    updatedBy: quote.updated_by ?? undefined,
    updatedByName: displayName(profiles, quote.updated_by),
    deletedAt: quote.deleted_at ?? undefined,
  }));
}

async function writeSupabaseQuotes(supabase: SupabaseClient, quotes: SavedQuote[]) {
  const quoteIds = quotes.map((quote) => dbUuid(quote.id, "quote")).filter(isUuid);
  await deleteMissingUuidRows(supabase, "quotes", quoteIds);
  await deleteAllRows(supabase, "quote_revisions");
  if (!quotes.length) return;

  const { error: quoteError } = await supabase.from("quotes").upsert(
    quotes.map((quote) => ({
      id: dbUuid(quote.id, "quote"),
      share_token: dbUuid(quote.shareToken, "share"),
      quote_number: quote.meta.quoteNumber || quote.id,
      customer: quote.meta.customer || "Unnamed customer",
      project: quote.meta.project || "Untitled project",
      location: quote.meta.location ?? null,
      email: quote.meta.email ?? null,
      margin_percent: quote.meta.marginPercent ?? 0,
      tax_percent: quote.meta.taxPercent ?? 0,
      include_labor: Boolean(quote.meta.includeLabor),
      labor_hours: quote.meta.laborHours ?? null,
      labor_rate: quote.meta.laborRate ?? null,
      scope_of_work: quote.meta.scopeOfWork ?? null,
      notes: quote.meta.notes ?? null,
      lines_snapshot: toJson(quote.lines),
      total: quote.total ?? 0,
      revision: Math.max(1, quote.revisions?.length ?? 1),
      updated_by: nullableUuid(quote.updatedBy),
      deleted_at: quote.deletedAt ?? null,
      created_at: quote.createdAt,
      updated_at: quote.updatedAt,
    })),
  );
  if (quoteError) throw new Error(quoteError.message);

  const revisions = quotes.flatMap((quote) =>
    (quote.revisions ?? []).map((revision, index) => ({
      id: dbUuid(revision.id, "revision"),
      quote_id: dbUuid(quote.id, "quote"),
      revision: index + 1,
      changed_by: nullableUuid(revision.editedBy),
      meta_snapshot: toJson(revision.meta),
      lines_snapshot: toJson(revision.lines),
      total: revision.total ?? 0,
      created_at: revision.savedAt,
    })),
  );
  if (!revisions.length) return;

  const { error: revisionError } = await supabase.from("quote_revisions").insert(revisions);
  if (revisionError) throw new Error(revisionError.message);
}

async function readSupabaseDrafts(supabase: SupabaseClient): Promise<DraftQuote[]> {
  const [draftsResult, profiles] = await Promise.all([supabase.from("draft_quotes").select("*").order("updated_at", { ascending: false }), readProfiles(supabase)]);
  if (draftsResult.error) throw new Error(draftsResult.error.message);
  return ((draftsResult.data ?? []) as DbRow[])
    .map((draft: DbRow) => ({
      id: draft.kind === "current" ? `current-${draft.owner_id}` : appId("draft", draft.id),
      owner: draft.owner_id,
      ownerName: displayName(profiles, draft.owner_id),
      deviceId: draft.device_id ?? undefined,
      kind: draft.kind,
      quoteStep: draft.quote_step,
      createdAt: draft.created_at,
      updatedAt: draft.updated_at,
      meta: asMeta(draft.meta_snapshot),
      lines: asQuoteLines(draft.lines_snapshot),
      total: Number(draft.total ?? 0),
    }))
    .filter((draft) => draft.lines.length > 0);
}

async function writeSupabaseDrafts(supabase: SupabaseClient, drafts: DraftQuote[]) {
  const activeDrafts = drafts.filter((draft) => draft.lines.length > 0 && isUuid(draft.owner));
  const draftIds = activeDrafts.map((draft) => draftDbId(draft)).filter(isUuid);
  await deleteMissingUuidRows(supabase, "draft_quotes", draftIds);
  if (!activeDrafts.length) return;

  const { error } = await supabase.from("draft_quotes").upsert(
    activeDrafts.map((draft) => ({
      id: draftDbId(draft),
      owner_id: draft.owner,
      device_id: draft.deviceId ?? null,
      kind: draft.kind ?? "saved",
      quote_step: draft.quoteStep ?? "pick",
      meta_snapshot: toJson(draft.meta),
      lines_snapshot: toJson(draft.lines),
      total: draft.total ?? 0,
      created_at: draft.createdAt,
      updated_at: draft.updatedAt,
    })),
  );
  if (error) throw new Error(error.message);
}

async function readSupabaseSessions(supabase: SupabaseClient): Promise<UserSessionRecord[]> {
  const [sessionsResult, profiles] = await Promise.all([supabase.from("user_sessions").select("*").order("last_seen_at", { ascending: false }), readProfiles(supabase)]);
  if (sessionsResult.error) throw new Error(sessionsResult.error.message);
  return ((sessionsResult.data ?? []) as DbRow[]).map((session: DbRow) => ({
    id: `${session.user_id}-${session.device_id}`,
    userId: session.user_id,
    userName: displayName(profiles, session.user_id) ?? "User",
    deviceId: session.device_id,
    deviceName: session.device_name,
    createdAt: session.created_at,
    lastSeenAt: session.last_seen_at,
    endedAt: session.ended_at ?? session.revoked_at ?? undefined,
  }));
}

async function writeSupabaseSessions(supabase: SupabaseClient, sessions: UserSessionRecord[]) {
  const activeSessions = sessions.filter((session) => isUuid(session.userId));
  const ids = activeSessions.map((session) => sessionDbId(session)).filter(isUuid);
  await deleteMissingUuidRows(supabase, "user_sessions", ids);
  if (!activeSessions.length) return;

  const { error } = await supabase.from("user_sessions").upsert(
    activeSessions.map((session) => ({
      id: sessionDbId(session),
      user_id: session.userId,
      device_id: session.deviceId,
      device_name: session.deviceName || "Browser",
      ended_at: session.endedAt ?? null,
      revoked_at: null,
      created_at: session.createdAt,
      last_seen_at: session.lastSeenAt,
    })),
  );
  if (error) throw new Error(error.message);
}

async function readSupabaseDebugLogs(supabase: SupabaseClient): Promise<DebugLogEntry[]> {
  const [logsResult, profiles] = await Promise.all([supabase.from("debug_logs").select("*").order("created_at", { ascending: false }).limit(200), readProfiles(supabase)]);
  if (logsResult.error) throw new Error(logsResult.error.message);
  return ((logsResult.data ?? []) as DbRow[]).map((log: DbRow) => ({
    id: appId("log", log.id),
    type: log.type,
    level: log.level,
    message: log.message,
    userId: log.user_id ?? undefined,
    userName: displayName(profiles, log.user_id),
    deviceId: log.device_id ?? undefined,
    metadata: isObject(log.metadata) ? log.metadata : undefined,
    createdAt: log.created_at,
  }));
}

async function writeSupabaseDebugLogs(supabase: SupabaseClient, logs: DebugLogEntry[]) {
  const ids = logs.map((log) => dbUuid(log.id, "log")).filter(isUuid);
  await deleteMissingUuidRows(supabase, "debug_logs", ids);
  if (!logs.length) return;

  const { error } = await supabase.from("debug_logs").upsert(
    logs.map((log) => ({
      id: dbUuid(log.id, "log"),
      type: log.type,
      level: log.level,
      message: log.message,
      user_id: nullableUuid(log.userId),
      device_id: log.deviceId ?? null,
      metadata: toJson(log.metadata ?? {}),
      created_at: log.createdAt,
    })),
  );
  if (error) throw new Error(error.message);
}

async function readSupabaseSettings(supabase: SupabaseClient): Promise<ServiceTitanSettings> {
  const { data, error } = await supabase.from("app_settings").select("value").eq("key", "settings").maybeSingle();
  if (error) throw new Error(error.message);
  return sanitizeSettings(data?.value);
}

async function writeSupabaseSettings(supabase: SupabaseClient, settings: ServiceTitanSettings) {
  const { error } = await supabase.from("app_settings").upsert({ key: "settings", value: toJson(sanitizeSettings(settings)), updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

async function readProfiles(supabase: SupabaseClient): Promise<ProfileMap> {
  const { data, error } = await supabase.from("profiles").select("id, email, display_name");
  if (error) return new Map();
  return new Map(((data ?? []) as DbRow[]).map((profile: DbRow) => [profile.id, { name: profile.display_name ?? undefined, email: profile.email ?? undefined }]));
}

async function deleteMissingUuidRows(supabase: SupabaseClient, tableName: string, keepIds: string[]) {
  if (!keepIds.length) return deleteAllRows(supabase, tableName);
  const { error } = await table(supabase, tableName).delete().not("id", "in", `(${keepIds.join(",")})`);
  if (error) throw new Error(error.message);
}

async function deleteAllRows(supabase: SupabaseClient, tableName: string) {
  const { error } = await table(supabase, tableName).delete().neq("id", nilUuid);
  if (error) throw new Error(error.message);
}

function getSupabaseClient() {
  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("Supabase is not configured");
  return supabase as unknown as SupabaseClient;
}

function table(supabase: SupabaseClient, tableName: string) {
  return supabase.from(tableName);
}

function isSupabaseStoreEnabled() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function appId(prefix: string, id: string) {
  return id.startsWith(`${prefix}-`) ? id : `${prefix}-${id}`;
}

function dbUuid(id: unknown, prefix: string) {
  const text = typeof id === "string" ? id : "";
  const candidate = text.startsWith(`${prefix}-`) ? text.slice(prefix.length + 1) : text;
  return isUuid(candidate) ? candidate : crypto.randomUUID();
}

function nullableUuid(id: unknown) {
  if (typeof id !== "string") return null;
  const candidate = id.includes("-") ? id.split("-").slice(-5).join("-") : id;
  return isUuid(candidate) ? candidate : null;
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}

function draftDbId(draft: DraftQuote) {
  if ((draft.kind ?? "saved") === "current" && isUuid(draft.owner)) return draft.owner;
  return dbUuid(draft.id, "draft");
}

function sessionDbId(session: UserSessionRecord) {
  return dbUuid(session.deviceId, "device");
}

function displayName(profiles: ProfileMap, id?: string | null) {
  if (!id) return undefined;
  const profile = profiles.get(id);
  return profile?.name ?? profile?.email;
}

function parseTemplateDescription(value: string): { description: string; categoryRequirements?: TemplateCategoryRequirement[] } {
  const markerIndex = value.lastIndexOf(templateMetadataPrefix);
  if (markerIndex === -1) return { description: value };
  const description = value.slice(0, markerIndex).trimEnd();
  const metadataJson = value.slice(markerIndex + templateMetadataPrefix.length);
  try {
    const parsed = JSON.parse(metadataJson) as { categoryRequirements?: unknown };
    const categoryRequirements = asTemplateCategoryRequirements(parsed.categoryRequirements);
    return { description, categoryRequirements };
  } catch {
    return { description: value };
  }
}

function serializeTemplateDescription(template: QuoteTemplate) {
  const description = template.description ?? "";
  const categoryRequirements = asTemplateCategoryRequirements(template.categoryRequirements);
  if (!categoryRequirements.length) return description;
  return `${description}${templateMetadataPrefix}${JSON.stringify({ categoryRequirements })}`;
}

function asTemplateCategoryRequirements(value: unknown): TemplateCategoryRequirement[] {
  return asArray<Partial<TemplateCategoryRequirement>>(value)
    .map((requirement) => ({
      id: typeof requirement.id === "string" && requirement.id ? requirement.id : crypto.randomUUID(),
      category: typeof requirement.category === "string" ? requirement.category.trim() : "",
      quantity: Math.max(1, Number(requirement.quantity) || 1),
    }))
    .filter((requirement) => requirement.category);
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asQuoteLines(value: unknown) {
  return Array.isArray(value) ? value as SavedQuote["lines"] : [];
}

function asMeta(value: unknown): QuoteMeta {
  const meta = isObject(value) ? value : {};
  return {
    customer: text(meta.customer),
    project: text(meta.project),
    location: text(meta.location),
    email: text(meta.email),
    quoteNumber: text(meta.quoteNumber),
    marginPercent: number(meta.marginPercent, 0),
    taxPercent: number(meta.taxPercent, 0),
    includeLabor: Boolean(meta.includeLabor),
    laborHours: number(meta.laborHours, 0),
    laborRate: number(meta.laborRate, 0),
    scopeOfWork: text(meta.scopeOfWork),
    notes: text(meta.notes),
  };
}

function emptySettings(): ServiceTitanSettings {
  return {};
}

function sanitizeSettings(value: unknown): ServiceTitanSettings {
  const settings = isObject(value) ? value : {};
  const exportColumns = Array.isArray(settings.exportColumns) ? settings.exportColumns.filter((column): column is ExportColumnKey => exportColumnKeys.includes(column as ExportColumnKey)) : undefined;
  return {
    lastSyncAt: typeof settings.lastSyncAt === "string" ? settings.lastSyncAt : undefined,
    taxState: typeof settings.taxState === "string" ? settings.taxState : undefined,
    defaultTaxPercent: Number.isFinite(Number(settings.defaultTaxPercent)) ? Number(settings.defaultTaxPercent) : undefined,
    exportColumns: exportColumns?.length ? exportColumns : undefined,
  };
}

function nullableNumber(value: unknown) {
  return value === null || value === undefined ? undefined : Number(value);
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function number(value: unknown, fallback: number) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}
