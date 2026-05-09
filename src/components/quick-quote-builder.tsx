"use client";

import {
  Bell,
  ChevronDown,
  ClipboardList,
  Database,
  FileText,
  History,
  Mail,
  Minus,
  Menu,
  Monitor,
  Plus,
  PackagePlus,
  Printer,
  Save,
  Settings,
  ShieldCheck,
  ShoppingCart,
  LogOut,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getPendingWriteCount, readDb, syncPendingWrites, writeDb } from "@/lib/client-db";
import type { SessionUser } from "@/lib/auth-types";
import type { CatalogItem, DraftQuote, QuoteLine, QuoteMeta, QuoteTemplate, SavedQuote, ServiceTitanSettings, UserSessionRecord } from "@/lib/types";

type View = "home" | "quote" | "items" | "templates" | "previous" | "settings" | "client";
type QuoteStep = "pick" | "customize" | "review" | "finalize";
type SettingsSection = "account" | "database" | "serviceTitan" | "adi" | "sync" | "recovery";
type AdiCatalogMatch = Omit<CatalogItem, "id"> & {
  imageUrl: string;
  manufacturerSku: string;
  matchScore?: number;
};
type DatabaseStatus = {
  provider: string;
  databaseName: string;
  persistent: boolean;
};
type QuoteTotals = {
  subtotal: number;
  equipmentSubtotal: number;
  laborAmount: number;
  marginAmount: number;
  taxAmount: number;
  total: number;
};
type PrintableQuote = {
  meta: QuoteMeta;
  lines: QuoteLine[];
  totals: QuoteTotals;
  createdAt?: string;
  revisionNumber?: number;
};
type TemplateRequirement = {
  id: string;
  label: string;
  quantity: number;
  terms: string[];
};
type ExportQuoteFormat = "print" | "pdf" | "excel" | "install";
type RecoverySort = "recent" | "name";
type PermanentDeleteTarget = { kind: "item"; id: string; label: string } | { kind: "quote"; id: string; label: string };
type NotificationBlock = { id: string; title: string; message: string; createdAt: string };
type QuoteHistoryEntry = {
  id: string;
  label: string;
  savedAt: string;
  editedByName: string;
  meta: QuoteMeta;
  lines: QuoteLine[];
  total: number;
  changes: string[];
};

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const appStage = process.env.NEXT_PUBLIC_APP_STAGE ?? "development";
const isProductionStage = appStage.toLowerCase() === "production";
const recoveryRetentionDays = 30;
const dayInMs = 24 * 60 * 60 * 1000;
const requiredQuoteDetailsError = "Add a customer name, project, and quote number before saving this quote.";
const placeholderUser: SessionUser = { id: "local-user", name: "User" };
const STORAGE_KEYS = {
  items: "qqb.cache.items.v1",
  templates: "qqb.cache.templates.v1",
  quotes: "qqb.cache.quotes.v1",
  settings: "qqb.cache.settings.v1",
  session: "qqb.session.v1",
  draftQuote: "qqb.draft.quote.v1",
  draftQuotes: "qqb.draft.quotes.v1",
  sessions: "qqb.cache.sessions.v1",
  deviceId: "qqb.device.id.v1",
};

const emptyMeta: QuoteMeta = {
  customer: "",
  project: "",
  location: "",
  email: "",
  quoteNumber: "QQ-1001",
  marginPercent: 18,
  taxPercent: 8.875,
  includeLabor: true,
  laborHours: 0,
  laborRate: 125,
  notes: "",
};

const isView = (value: unknown): value is View => ["home", "quote", "items", "templates", "previous", "settings", "client"].includes(String(value));
const isQuoteStep = (value: unknown): value is QuoteStep => ["pick", "customize", "review", "finalize"].includes(String(value));
const quoteSlugFromPath = () => {
  if (typeof window === "undefined") return "";
  const [, viewSegment, slug] = window.location.pathname.split("/");
  return viewSegment === "previous" || viewSegment === "client" ? slug ?? "" : "";
};
const findQuoteByShareToken = (quotes: SavedQuote[], token: string) => quotes.find((quote) => quote.shareToken === token) ?? null;
const viewPath = (view: View, quote?: SavedQuote) => {
  if (view === "home") return "/";
  if ((view === "previous" || view === "client") && quote?.shareToken) return `/${view}/${quote.shareToken}`;
  return `/${view}`;
};
const viewFromPath = () => {
  if (typeof window === "undefined") return null;
  const segment = window.location.pathname.split("/").filter(Boolean)[0];
  return isView(segment) ? segment : window.location.pathname === "/" ? "home" : null;
};

function getOrCreateDeviceId() {
  if (typeof window === "undefined") return "server";
  const existing = window.localStorage.getItem(STORAGE_KEYS.deviceId);
  if (existing) return existing;
  const next = makeId("device");
  window.localStorage.setItem(STORAGE_KEYS.deviceId, next);
  return next;
}

function getDeviceName() {
  if (typeof navigator === "undefined") return "Current device";
  const platform = navigator.platform || "Browser";
  return `${platform} / ${navigator.userAgent.includes("Mobile") ? "Mobile" : "Desktop"}`;
}

const adiCatalog: AdiCatalogMatch[] = [
  {
    sku: "AXIS-P3265-LVE",
    manufacturerSku: "P3265-LVE",
    name: "Axis P3265-LVE Outdoor Dome Network Camera",
    category: "Camera",
    unitPrice: 724,
    msrp: 899,
    vendor: "ADI",
    inventory: 12,
    notes: "ADI placeholder match. Replace with live ADI API data when credentials are connected.",
    imageUrl: "https://placehold.co/180x135/e7f5f2/0f766e?text=Axis+Camera",
  },
  {
    sku: "HON-PW6K1IC",
    manufacturerSku: "PW6K1IC",
    name: "Honeywell Pro-Watch Intelligent Controller",
    category: "Access Control",
    unitPrice: 930,
    msrp: 1195,
    vendor: "ADI",
    inventory: 5,
    notes: "ADI placeholder match. Replace with live ADI API data when credentials are connected.",
    imageUrl: "https://placehold.co/180x135/f2f4f7/334155?text=Honeywell+Panel",
  },
  {
    sku: "HID-920NTNNEK00000",
    manufacturerSku: "920NTNNEK00000",
    name: "HID Signo 20 Mullion Smart Card Reader",
    category: "Access Control",
    unitPrice: 185,
    msrp: 245,
    vendor: "ADI",
    inventory: 28,
    notes: "ADI placeholder match. Replace with live ADI API data when credentials are connected.",
    imageUrl: "https://placehold.co/180x135/f8fafc/1f2937?text=HID+Reader",
  },
  {
    sku: "ASSA-9600-LBM",
    manufacturerSku: "9600-LBM",
    name: "ASSA ABLOY HES 9600 Electric Strike",
    category: "Door Hardware",
    unitPrice: 318,
    msrp: 415,
    vendor: "ADI",
    inventory: 18,
    notes: "ADI placeholder match. Replace with live ADI API data when credentials are connected.",
    imageUrl: "https://placehold.co/180x135/f4f4f5/525252?text=9600+Strike",
  },
  {
    sku: "ALTRONIX-AL600ULACM",
    manufacturerSku: "AL600ULACM",
    name: "Altronix Access Power Controller with Power Supply",
    category: "Power",
    unitPrice: 265,
    msrp: 349,
    vendor: "ADI",
    inventory: 9,
    notes: "ADI placeholder match. Replace with live ADI API data when credentials are connected.",
    imageUrl: "https://placehold.co/180x135/fff7ed/9a3412?text=Power+Supply",
  },
];

const makeId = (prefix: string) => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const makeShareToken = () => makeId("share");

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T) {
  if (typeof window !== "undefined") window.localStorage.setItem(key, JSON.stringify(value));
}

function daysUntilRecoveryPurge(deletedAt?: string) {
  if (!deletedAt) return recoveryRetentionDays;
  const deletedTime = new Date(deletedAt).getTime();
  if (Number.isNaN(deletedTime)) return recoveryRetentionDays;
  return Math.max(0, Math.ceil((deletedTime + recoveryRetentionDays * dayInMs - Date.now()) / dayInMs));
}

function shouldPurgeRecoveredRecord(deletedAt?: string) {
  return Boolean(deletedAt && daysUntilRecoveryPurge(deletedAt) <= 0);
}

function recoveryUrgencyClasses(daysRemaining: number) {
  if (daysRemaining <= 3) return "border-red-300 bg-red-100 text-red-950";
  if (daysRemaining <= 7) return "border-red-200 bg-red-50 text-red-900";
  if (daysRemaining <= 14) return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-stone-200 bg-white text-stone-950";
}

function isLabor(line: QuoteLine) {
  return line.sku.toLowerCase().startsWith("lab-") || line.name.toLowerCase().includes("labor");
}

function normalizeSearchValue(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function fuzzyScore(query: string, candidate: AdiCatalogMatch) {
  const normalizedQuery = normalizeSearchValue(query);
  if (normalizedQuery.length < 2) return 0;
  const searchable = normalizeSearchValue(`${candidate.name} ${candidate.sku} ${candidate.manufacturerSku} ${candidate.category}`);
  const compactSearchable = searchable.replace(/\s/g, "");
  const compactQuery = normalizedQuery.replace(/\s/g, "");
  let score = 0;

  if (searchable.includes(normalizedQuery)) score += 70;
  if (compactSearchable.includes(compactQuery)) score += 45;

  const tokens = normalizedQuery.split(" ").filter(Boolean);
  tokens.forEach((token) => {
    if (searchable.includes(token)) score += token.length > 3 ? 16 : 8;
  });

  if (candidate.sku.toLowerCase().includes(compactQuery) || candidate.manufacturerSku.toLowerCase().includes(compactQuery)) score += 40;
  return Math.min(score, 100);
}

function getDoorTemplateRequirements(template: QuoteTemplate): TemplateRequirement[] {
  const text = normalizeSearchValue(`${template.name} ${template.description}`);
  if (!text.includes("door") && !text.includes("access")) return [];
  const readerQuantity = /\b(2|two|dual)\b/.test(text) || text.includes("in out") || text.includes("entry exit") ? 2 : 1;

  return [
    { id: "strike", label: "Door strike", quantity: 1, terms: ["strike", "9600", "hes"] },
    { id: "reader", label: readerQuantity > 1 ? "Readers" : "Reader", quantity: readerQuantity, terms: ["reader", "hid", "signo"] },
    { id: "contact", label: "Door contact", quantity: 1, terms: ["contact", "door contact", "reed"] },
    { id: "rex", label: "REX", quantity: 1, terms: ["rex", "request to exit", "motion"] },
    { id: "panel", label: "Honeywell panel", quantity: 1, terms: ["honeywell", "panel", "controller", "pw6"] },
  ];
}

function itemMatchesRequirement(item: CatalogItem, requirement: TemplateRequirement) {
  const searchable = normalizeSearchValue(`${item.name} ${item.sku} ${item.category} ${item.vendor ?? ""} ${item.notes ?? ""}`);
  return requirement.terms.some((term) => searchable.includes(normalizeSearchValue(term)));
}

function buildQuoteTotals(lines: QuoteLine[], meta: QuoteMeta): QuoteTotals {
  const equipmentSubtotal = lines.filter((line) => !isLabor(line)).reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const laborAmount = meta.includeLabor ? (meta.laborHours ?? 0) * (meta.laborRate ?? 0) : 0;
  const subtotal = equipmentSubtotal + laborAmount;
  const marginAmount = subtotal * (meta.marginPercent / 100);
  const taxable = subtotal + marginAmount;
  const taxAmount = taxable * (meta.taxPercent / 100);
  return { subtotal, equipmentSubtotal, laborAmount, marginAmount, taxAmount, total: taxable + taxAmount };
}

function totalsFromSavedQuote(quote: SavedQuote): QuoteTotals {
  const calculated = buildQuoteTotals(quote.lines, quote.meta);
  return { ...calculated, total: quote.total || calculated.total };
}

export function QuickQuoteBuilder({ initialUser }: { initialUser?: SessionUser | null }) {
  const [view, setView] = useState<View>(() => {
    const pathView = viewFromPath();
    if (pathView) return pathView;
    const session = readStorage<{ view?: unknown }>(STORAGE_KEYS.session, {});
    return isView(session.view) ? session.view : "home";
  });
  const [quoteStep, setQuoteStep] = useState<QuoteStep>(() => {
    const session = readStorage<{ quoteStep?: unknown }>(STORAGE_KEYS.session, {});
    return isQuoteStep(session.quoteStep) ? session.quoteStep : "pick";
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [templates, setTemplates] = useState<QuoteTemplate[]>([]);
  const [quotes, setQuotes] = useState<SavedQuote[]>([]);
  const [draftQuotes, setDraftQuotes] = useState<DraftQuote[]>([]);
  const [sessions, setSessions] = useState<UserSessionRecord[]>([]);
  const [settings, setSettings] = useState<ServiceTitanSettings>({
    baseUrl: "",
    tenantId: "",
    clientId: "",
    clientSecret: "",
  });
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [meta, setMeta] = useState<QuoteMeta>(emptyMeta);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [emailPromptOpen, setEmailPromptOpen] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [selectedQuote, setSelectedQuote] = useState<SavedQuote | null>(null);
  const [routeQuoteSlug, setRouteQuoteSlug] = useState(() => quoteSlugFromPath());
  const [printableQuote, setPrintableQuote] = useState<PrintableQuote | null>(null);
  const [quoteSaveError, setQuoteSaveError] = useState("");
  const [editingQuoteId, setEditingQuoteId] = useState("");
  const [notifications, setNotifications] = useState<NotificationBlock[]>([]);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [startFreshPromptOpen, setStartFreshPromptOpen] = useState(false);
  const [sessionUser] = useState<SessionUser>(initialUser ?? placeholderUser);
  const [deviceId] = useState(() => getOrCreateDeviceId());
  const [deviceName] = useState(() => getDeviceName());
  const [databaseStatus, setDatabaseStatus] = useState<DatabaseStatus | null>(null);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [pendingOfflineWrites, setPendingOfflineWrites] = useState(0);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [serverDraftChecked, setServerDraftChecked] = useState(false);
  const [localDraftUpdatedAt, setLocalDraftUpdatedAt] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const cartRef = useRef<HTMLDetailsElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const settingsHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeItems = useMemo(() => items.filter((item) => !item.deletedAt), [items]);
  const activeQuotes = useMemo(() => quotes.filter((quote) => !quote.deletedAt), [quotes]);
  const userDraftQuotes = useMemo(() => draftQuotes.filter((draft) => draft.owner === sessionUser.id || draft.owner === sessionUser.name), [draftQuotes, sessionUser.id, sessionUser.name]);
  const userSessions = useMemo(() => sessions.filter((session) => session.userId === sessionUser.id && !session.endedAt && Date.now() - new Date(session.lastSeenAt).getTime() < 12 * 60 * 60 * 1000), [sessions, sessionUser.id]);
  const activeLines = useMemo(() => lines.filter((line) => !isLabor(line)), [lines]);
  const totals = useMemo(() => buildQuoteTotals(lines, meta), [lines, meta]);
  const cartCount = activeLines.reduce((sum, line) => sum + line.quantity, 0);

  const navigateToView = (nextView: View, quote?: SavedQuote) => {
    setView(nextView);
    setRouteQuoteSlug(quote?.shareToken ?? "");
    if (typeof window === "undefined") return;
    const nextPath = viewPath(nextView, quote);
    if (window.location.pathname !== nextPath) window.history.pushState({ view: nextView }, "", nextPath);
  };

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      readDb<CatalogItem[]>("items", readStorage(STORAGE_KEYS.items, [])),
      readDb<QuoteTemplate[]>("templates", readStorage(STORAGE_KEYS.templates, [])),
      readDb<SavedQuote[]>("quotes", readStorage(STORAGE_KEYS.quotes, [])),
      readDb<DraftQuote[]>("drafts", readStorage(STORAGE_KEYS.draftQuotes, [])),
      readDb<UserSessionRecord[]>("sessions", readStorage(STORAGE_KEYS.sessions, [])),
      readDb<ServiceTitanSettings>("settings", readStorage(STORAGE_KEYS.settings, { baseUrl: "", tenantId: "", clientId: "", clientSecret: "" })),
    ]).then(([dbItems, dbTemplates, dbQuotes, dbDraftQuotes, dbSessions, dbSettings]) => {
      if (cancelled) return;
      setItems(dbItems);
      setTemplates(dbTemplates);
      setQuotes(dbQuotes);
      setDraftQuotes(Array.isArray(dbDraftQuotes) ? dbDraftQuotes : []);
      setSessions(Array.isArray(dbSessions) ? dbSessions : []);
      setSettings(dbSettings);
      setHydrated(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const draft = readStorage<{ lines?: QuoteLine[]; meta?: Partial<QuoteMeta>; quoteStep?: unknown; updatedAt?: string }>(STORAGE_KEYS.draftQuote, {});
    setLines(Array.isArray(draft.lines) ? draft.lines : []);
    setMeta({ ...emptyMeta, ...(draft.meta ?? {}) });
    if (isQuoteStep(draft.quoteStep)) setQuoteStep(draft.quoteStep);
    setLocalDraftUpdatedAt(draft.updatedAt ?? "");
    setDraftHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !draftHydrated || serverDraftChecked) return;
    const serverDraft = draftQuotes
      .filter((draft) => draft.kind === "current" && draft.owner === sessionUser.id)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
    const localTime = localDraftUpdatedAt ? new Date(localDraftUpdatedAt).getTime() : 0;
    const serverTime = serverDraft ? new Date(serverDraft.updatedAt).getTime() : 0;
    if (serverDraft && serverTime > localTime) {
      setLines(serverDraft.lines);
      setMeta({ ...emptyMeta, ...serverDraft.meta });
      if (serverDraft.quoteStep && isQuoteStep(serverDraft.quoteStep)) setQuoteStep(serverDraft.quoteStep);
      pushNotification("Draft restored", `Loaded the latest server draft from ${serverDraft.deviceName || "another device"}.`);
    }
    setServerDraftChecked(true);
  }, [draftHydrated, draftQuotes, hydrated, localDraftUpdatedAt, serverDraftChecked, sessionUser.id]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.session, { view, quoteStep, user: sessionUser });
  }, [quoteStep, sessionUser, view]);

  useEffect(() => {
    const handlePopState = () => {
      const pathView = viewFromPath();
      if (pathView) setView(pathView);
      setRouteQuoteSlug(quoteSlugFromPath());
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if ((view !== "previous" && view !== "client") || !routeQuoteSlug) return;
    const quote = findQuoteByShareToken(activeQuotes, routeQuoteSlug);
    if (quote && selectedQuote?.id !== quote.id) setSelectedQuote(quote);
  }, [activeQuotes, routeQuoteSlug, selectedQuote?.id, view]);

  useEffect(() => {
    if (draftHydrated) {
      const draft = { lines, meta, quoteStep, updatedAt: new Date().toISOString() };
      writeStorage(STORAGE_KEYS.draftQuote, draft);
    }
  }, [draftHydrated, lines, meta, quoteStep]);

  useEffect(() => {
    if (!hydrated || !draftHydrated || !serverDraftChecked) return;
    const now = new Date().toISOString();
    const currentDraft: DraftQuote = {
      id: `current-${sessionUser.id}-${deviceId}`,
      owner: sessionUser.id,
      ownerName: sessionUser.name,
      deviceId,
      deviceName,
      kind: "current",
      quoteStep,
      createdAt: now,
      updatedAt: now,
      meta,
      lines: activeLines,
      total: totals.total,
    };
    setDraftQuotes((current) => {
      const existing = current.find((draft) => draft.id === currentDraft.id);
      const nextDraft = existing ? { ...currentDraft, createdAt: existing.createdAt } : currentDraft;
      return [nextDraft, ...current.filter((draft) => draft.id !== currentDraft.id)];
    });
  }, [activeLines, deviceId, deviceName, draftHydrated, hydrated, meta, quoteStep, serverDraftChecked, sessionUser.id, sessionUser.name, totals.total]);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncNow = () => {
      setIsOnline(navigator.onLine);
      if (navigator.onLine) {
        void syncPendingWrites().then((result) => setPendingOfflineWrites(result.pending));
      } else {
        setPendingOfflineWrites(getPendingWriteCount());
      }
    };

    syncNow();
    window.addEventListener("online", syncNow);
    window.addEventListener("offline", syncNow);
    return () => {
      window.removeEventListener("online", syncNow);
      window.removeEventListener("offline", syncNow);
    };
  }, []);

  useEffect(() => {
    if (quoteSaveError === requiredQuoteDetailsError && meta.customer.trim() && meta.project.trim() && meta.quoteNumber.trim()) {
      setQuoteSaveError("");
    }
  }, [meta.customer, meta.project, meta.quoteNumber, quoteSaveError]);

  useEffect(() => {
    if (!hydrated) return;
    setItems((current) => current.filter((item) => !shouldPurgeRecoveredRecord(item.deletedAt)));
    setQuotes((current) => current.filter((quote) => !shouldPurgeRecoveredRecord(quote.deletedAt)));
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    setQuotes((current) => {
      let changed = false;
      const nextQuotes = current.map((quote) => {
        if (quote.shareToken) return quote;
        changed = true;
        return { ...quote, shareToken: makeShareToken(), updatedAt: new Date().toISOString() };
      });
      return changed ? nextQuotes : current;
    });
  }, [hydrated]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/db/status", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((status: DatabaseStatus | null) => {
        if (!cancelled) setDatabaseStatus(status);
      })
      .catch(() => {
        if (!cancelled) setDatabaseStatus(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (hydrated) {
      writeStorage(STORAGE_KEYS.items, items);
      void writeDb("items", items).then(() => setPendingOfflineWrites(getPendingWriteCount()));
    }
  }, [hydrated, items]);

  useEffect(() => {
    if (hydrated) {
      writeStorage(STORAGE_KEYS.templates, templates);
      void writeDb("templates", templates).then(() => setPendingOfflineWrites(getPendingWriteCount()));
    }
  }, [hydrated, templates]);

  useEffect(() => {
    if (hydrated) {
      writeStorage(STORAGE_KEYS.quotes, quotes);
      void writeDb("quotes", quotes).then(() => setPendingOfflineWrites(getPendingWriteCount()));
    }
  }, [hydrated, quotes]);

  useEffect(() => {
    if (hydrated) {
      writeStorage(STORAGE_KEYS.draftQuotes, draftQuotes);
      void writeDb("drafts", draftQuotes).then(() => setPendingOfflineWrites(getPendingWriteCount()));
    }
  }, [draftQuotes, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const now = new Date().toISOString();
    const sessionId = `${sessionUser.id}-${deviceId}`;
    setSessions((current) => {
      const existing = current.find((session) => session.id === sessionId);
      const nextSession: UserSessionRecord = {
        id: sessionId,
        userId: sessionUser.id,
        userName: sessionUser.name,
        deviceId,
        deviceName,
        createdAt: existing?.createdAt ?? now,
        lastSeenAt: now,
      };
      return [nextSession, ...current.filter((session) => session.id !== sessionId)];
    });
  }, [deviceId, deviceName, hydrated, sessionUser.id, sessionUser.name]);

  useEffect(() => {
    if (hydrated) {
      writeStorage(STORAGE_KEYS.sessions, sessions);
      void writeDb("sessions", sessions).then(() => setPendingOfflineWrites(getPendingWriteCount()));
    }
  }, [hydrated, sessions]);

  useEffect(() => {
    if (hydrated) {
      writeStorage(STORAGE_KEYS.settings, settings);
      void writeDb("settings", settings).then(() => setPendingOfflineWrites(getPendingWriteCount()));
    }
  }, [hydrated, settings]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;

      if (cartOpen && cartRef.current && !cartRef.current.contains(target)) {
        setCartOpen(false);
      }

      if (notificationOpen && notificationRef.current && !notificationRef.current.contains(target)) {
        setNotificationOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [cartOpen, notificationOpen]);

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return activeItems.filter((item) => {
      const matchesCategory = category === "All" || item.category === category;
      const matchesSearch = !query || [item.name, item.sku, item.vendor, item.notes].some((value) => value?.toLowerCase().includes(query));
      return matchesCategory && matchesSearch;
    });
  }, [activeItems, search, category]);
  const catalogCategories = useMemo(() => ["All", ...Array.from(new Set(activeItems.map((item) => item.category).filter(Boolean))).sort((a, b) => a.localeCompare(b))], [activeItems]);

  useEffect(() => {
    if (category !== "All" && !catalogCategories.includes(category)) {
      setCategory("All");
    }
  }, [catalogCategories, category]);

  const pushNotification = (title: string, message: string) => {
    setNotifications((current) => [{ id: makeId("note"), title, message, createdAt: new Date().toISOString() }, ...current].slice(0, 8));
  };

  const dismissNotification = (id: string) => {
    setNotifications((current) => current.filter((notification) => notification.id !== id));
  };

  const saveDraftQuote = (label = "Temporary quote") => {
    if (!activeLines.length && !meta.customer.trim() && !meta.project.trim()) return;
    const now = new Date().toISOString();
    const draft: DraftQuote = {
      id: makeId("draft"),
      owner: sessionUser.id,
      ownerName: sessionUser.name,
      deviceId,
      deviceName,
      kind: "saved",
      quoteStep,
      createdAt: now,
      updatedAt: now,
      meta: { ...meta, project: meta.project.trim() || label },
      lines: activeLines,
      total: totals.total,
    };
    setDraftQuotes((current) => [draft, ...current]);
    pushNotification("Draft saved", `This quote was saved to ${sessionUser.name}'s workspace.`);
  };

  const clearCurrentQuote = () => {
    setLines([]);
    setMeta(emptyMeta);
    setEditingQuoteId("");
    setQuoteSaveError("");
    setQuoteStep("customize");
  };

  const startFresh = () => {
    if (activeLines.length || meta.customer.trim() || meta.project.trim()) {
      setStartFreshPromptOpen(true);
      return;
    }
    clearCurrentQuote();
  };

  const loadDraftQuote = (draft: DraftQuote) => {
    setMeta(draft.meta);
    setLines(draft.lines);
    setEditingQuoteId("");
    navigateToView("quote");
    setQuoteStep("customize");
  };

  const startSettingsHold = () => {
    if (adminUnlocked) return;
    if (settingsHoldTimer.current) clearTimeout(settingsHoldTimer.current);
    settingsHoldTimer.current = setTimeout(() => {
      setAdminUnlocked(true);
      pushNotification("Admin panel unlocked", "ServiceTitan, ADI, sync, and recovery settings are now available.");
    }, 5000);
  };

  const cancelSettingsHold = () => {
    if (!settingsHoldTimer.current) return;
    clearTimeout(settingsHoldTimer.current);
    settingsHoldTimer.current = null;
  };

  const addItem = (item: CatalogItem, packageName?: string, quantity = 1) => {
    setLines((current) => {
      const existing = current.find((line) => line.itemId === item.id && line.packageName === packageName);
      if (existing) {
        return current.map((line) => (line.lineId === existing.lineId ? { ...line, quantity: line.quantity + quantity } : line));
      }
      return [
        ...current,
        {
          lineId: makeId("line"),
          itemId: item.id,
          name: item.name,
          sku: item.sku,
          packageName,
          quantity,
          unitPrice: item.unitPrice,
          msrp: item.msrp,
          notes: item.notes ?? "",
        },
      ];
    });
  };

  const addTemplate = (template: QuoteTemplate, jumpToCustomize = true) => {
    template.lines.forEach((line) => {
      const item = activeItems.find((candidate) => candidate.id === line.itemId);
      if (item) addItem(item, template.name, line.quantity);
    });
    pushNotification("Template added", `${template.name || "Template"} was added to the quote workspace.`);
    if (jumpToCustomize) {
      navigateToView("quote");
      setQuoteStep("customize");
    }
  };

  const updateLine = (lineId: string, patch: Partial<QuoteLine>) => {
    setLines((current) => current.map((line) => (line.lineId === lineId ? { ...line, ...patch } : line)));
  };

  const renamePackage = (packageName: string, nextName: string) => {
    const cleanName = nextName.trim() || packageName;
    setLines((current) => current.map((line) => (line.packageName === packageName ? { ...line, packageName: cleanName } : line)));
  };

  const deleteItemEverywhere = (itemId: string) => {
    const usedTemplates = templates.filter((template) => template.lines.some((line) => line.itemId === itemId));
    if (usedTemplates.length) {
      const templateNames = usedTemplates.map((template) => template.name || "Unnamed template").join(", ");
      const message = `This item is used by: ${templateNames}. Remove it from those templates before deleting it.`;
      pushNotification("Item delete blocked", message);
      return message;
    }
    const deletedAt = new Date().toISOString();
    setItems((current) => current.map((item) => (item.id === itemId ? { ...item, deletedAt } : item)));
    setLines((current) => current.filter((line) => line.itemId !== itemId));
    return null;
  };

  const saveQuote = () => {
    const quoteNumber = meta.quoteNumber.trim();
    if (!meta.customer.trim() || !meta.project.trim() || !quoteNumber) {
      setQuoteSaveError(requiredQuoteDetailsError);
      setQuoteStep("finalize");
      return;
    }

    const duplicateQuote = activeQuotes.find((quote) => quote.id !== editingQuoteId && quote.meta.quoteNumber.trim().toLowerCase() === quoteNumber.toLowerCase());
    if (duplicateQuote) {
      setQuoteSaveError(`Quote number ${quoteNumber} is already used by ${duplicateQuote.meta.customer || "another saved quote"}. Use a unique quote number before saving.`);
      setQuoteStep("finalize");
      return;
    }

    const now = new Date().toISOString();
    const cleanMeta = {
      ...meta,
      customer: meta.customer.trim(),
      project: meta.project.trim(),
      location: meta.location?.trim() ?? "",
      quoteNumber,
      notes: meta.notes?.trim() ?? "",
    };
    if (editingQuoteId) {
      const originalQuote = activeQuotes.find((quote) => quote.id === editingQuoteId);
      if (!originalQuote) return;
      const revision = {
        id: makeId("revision"),
        savedAt: now,
        meta: originalQuote.meta,
        lines: originalQuote.lines,
        total: originalQuote.total,
        editedBy: originalQuote.updatedBy,
        editedByName: originalQuote.updatedByName,
      };
      const updatedQuote: SavedQuote = {
        ...originalQuote,
        updatedAt: now,
        meta: cleanMeta,
        lines: activeLines,
        total: totals.total,
        revisions: [...(originalQuote.revisions ?? []), revision],
        updatedBy: sessionUser.id,
        updatedByName: sessionUser.name,
      };
      setQuotes((current) => current.map((quote) => (quote.id === editingQuoteId ? updatedQuote : quote)));
      setQuoteSaveError("");
      setSelectedQuote(updatedQuote);
      navigateToView("previous", updatedQuote);
      setEditingQuoteId("");
      setLines([]);
      setMeta(emptyMeta);
      setQuoteStep("pick");
      pushNotification("Quote updated", "A revision snapshot was saved before applying the latest changes.");
      return;
    }

    const saved: SavedQuote = {
      id: makeId("quote"),
      shareToken: makeShareToken(),
      createdAt: now,
      updatedAt: now,
      meta: cleanMeta,
      lines: activeLines,
      total: totals.total,
      revisions: [],
      updatedBy: sessionUser.id,
      updatedByName: sessionUser.name,
    };
    setQuoteSaveError("");
    setQuotes((current) => [saved, ...current]);
    setSelectedQuote(saved);
    navigateToView("previous", saved);
    setLines([]);
    setMeta(emptyMeta);
    setQuoteStep("pick");
    pushNotification("Quote saved", `${saved.meta.quoteNumber} is now in Previous Quotes for the team.`);
  };

  const loadQuoteForEdit = (quote: SavedQuote) => {
    setMeta(quote.meta);
    setLines(quote.lines);
    setEditingQuoteId(quote.id);
    setSelectedQuote(null);
    setRouteQuoteSlug("");
    navigateToView("quote");
    setQuoteStep("customize");
  };

  const printQuote = () => {
    setPrintableQuote(null);
    window.setTimeout(() => window.print(), 80);
  };
  const printSavedQuote = (quote: SavedQuote) => {
    setPrintableQuote({ meta: quote.meta, lines: quote.lines, totals: totalsFromSavedQuote(quote), createdAt: quote.createdAt, revisionNumber: (quote.revisions?.length ?? 0) + 1 });
    window.setTimeout(() => window.print(), 80);
  };

  const sendEmail = () => {
    setMeta((current) => ({ ...current, email: pendingEmail }));
    setPrintableQuote(null);
    setEmailPromptOpen(false);
    window.setTimeout(() => window.print(), 80);
  };

  const syncServiceTitan = () => {
    setSettings((current) => ({ ...current, lastSyncAt: new Date().toISOString() }));
  };

  const nav = [
    { id: "home" as const, label: "Home", icon: ClipboardList },
    { id: "quote" as const, label: "Quote", icon: ClipboardList },
    { id: "items" as const, label: "Items", icon: PackagePlus },
    { id: "templates" as const, label: "Templates", icon: FileText },
    { id: "previous" as const, label: "Previous Quotes", icon: Database },
    { id: "settings" as const, label: "Settings", icon: Settings },
  ];
  const isClientView = view === "client";

  const goToQuote = () => {
    navigateToView("quote");
    setMenuOpen(false);
    setCartOpen(false);
    setNotificationOpen(false);
  };

  const goToHome = () => {
    navigateToView("home");
    setMenuOpen(false);
    setCartOpen(false);
    setNotificationOpen(false);
  };

  const signOut = async () => {
    const endedAt = new Date().toISOString();
    setSessions((current) => current.map((session) => (session.id === `${sessionUser.id}-${deviceId}` ? { ...session, endedAt, lastSeenAt: endedAt } : session)));
    await writeDb("sessions", sessions.map((session) => (session.id === `${sessionUser.id}-${deviceId}` ? { ...session, endedAt, lastSeenAt: endedAt } : session))).catch(() => undefined);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    window.location.href = "/login";
  };

  return (
    <main className="min-h-screen bg-stone-100 text-stone-950">
      <header className="sticky top-0 z-40 border-b border-stone-200 bg-stone-100/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {!isClientView ? (
              <button className="icon-button md:hidden" onClick={() => setMenuOpen(true)} aria-label="Open menu">
                <Menu size={19} />
              </button>
            ) : null}
            <button className="grid size-10 place-items-center rounded-lg bg-stone-900 text-xl font-black text-white disabled:cursor-default" onClick={isClientView ? undefined : goToHome} disabled={isClientView} aria-label="Go to home page">
              Q
            </button>
            <button className="min-w-0 text-left disabled:cursor-default" onClick={isClientView ? undefined : goToHome} disabled={isClientView} aria-label="Go to home page">
              <span className="flex min-w-0 flex-wrap items-center gap-2">
                <h1 className="truncate text-lg font-black leading-tight sm:text-2xl">Quick Quote Builder</h1>
                {!isProductionStage ? <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-1 text-xs font-black uppercase tracking-normal text-amber-900">Dev Build</span> : null}
              </span>
              <p className="hidden text-sm text-stone-600 sm:block">Quote equipment, labor, templates, and saved jobs.</p>
            </button>
          </div>
          {!isClientView ? (
            <nav className="hidden items-center gap-2 md:flex">
              {nav.map((item) => (
                <button
                  key={item.id}
                  className={`nav-button ${view === item.id ? "nav-button-active" : ""}`}
                  onPointerDown={item.id === "settings" ? startSettingsHold : undefined}
                  onPointerUp={item.id === "settings" ? cancelSettingsHold : undefined}
                  onPointerLeave={item.id === "settings" ? cancelSettingsHold : undefined}
                  onClick={() => navigateToView(item.id)}
                >
                  <item.icon size={16} />
                  {item.label}
                </button>
              ))}
            </nav>
          ) : null}
          {!isClientView ? <div className="flex items-center gap-2">
            <details ref={cartRef} className="group relative" open={cartOpen}>
              <summary
                className="icon-button relative list-none bg-teal-700 text-white [&::-webkit-details-marker]:hidden"
                aria-label="Shopping cart"
                onClick={(event) => {
                  event.preventDefault();
                  setCartOpen((open) => !open);
                  setNotificationOpen(false);
                }}
              >
                <ShoppingCart size={19} />
                <span className="absolute -right-2 -top-2 grid min-w-6 place-items-center rounded-full border-2 border-white bg-red-700 px-1 text-xs font-black">
                  {cartCount}
                </span>
              </summary>
              <CartDropdown
                lines={activeLines}
                totals={totals}
                onUpdateLine={updateLine}
                onRenamePackage={renamePackage}
                onRemoveLine={(id) => setLines((current) => current.filter((line) => line.lineId !== id))}
                onNext={() => {
                  navigateToView("quote");
                  setQuoteStep("finalize");
                  setCartOpen(false);
                }}
                onClose={() => setCartOpen(false)}
              />
            </details>
            <div ref={notificationRef} className="relative">
              <button
                className="icon-button relative"
                onClick={() => {
                  setNotificationOpen((open) => !open);
                  setCartOpen(false);
                }}
                aria-label="Notifications"
              >
                <Bell size={18} />
                {!isOnline || pendingOfflineWrites || notifications.length ? <span className="absolute right-2 top-2 size-2 rounded-full bg-red-700" /> : null}
              </button>
              {notificationOpen ? (
                <div className="absolute right-0 top-12 z-50 w-80 rounded-lg border border-stone-200 bg-white p-4 shadow-xl">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-bold">Notifications</p>
                    {notifications.length ? (
                      <button className="text-xs font-bold text-stone-500 hover:text-red-800" onClick={() => setNotifications([])}>
                        Dismiss all
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-2 grid gap-2 text-sm text-stone-600">
                    {notifications.map((notification) => (
                      <div key={notification.id} className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-black text-stone-950">{notification.title}</p>
                            <p className="mt-1">{notification.message}</p>
                          </div>
                          <button className="text-xs font-bold text-stone-500 hover:text-red-800" onClick={() => dismissNotification(notification.id)}>
                            Dismiss
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="rounded-lg border border-stone-200 bg-white p-3">
                      <p>{isOnline ? "Online. Database changes sync automatically." : "Offline. Changes are saved locally and will sync when the browser is online again."}</p>
                      <p className="mt-1">{pendingOfflineWrites ? `${pendingOfflineWrites} database update${pendingOfflineWrites === 1 ? "" : "s"} waiting to sync.` : "No offline database updates waiting."}</p>
                    </div>
                    <div className="rounded-lg border border-stone-200 bg-white p-3">ServiceTitan sync is in placeholder mode until production credentials are connected.</div>
                  </div>
                </div>
              ) : null}
            </div>
          </div> : null}
        </div>
      </header>

      {menuOpen && !isClientView ? <MobileMenu nav={nav} view={view} setView={navigateToView} goToQuote={goToQuote} close={() => setMenuOpen(false)} onSignOut={signOut} onSettingsHoldStart={startSettingsHold} onSettingsHoldEnd={cancelSettingsHold} /> : null}

      <section className={`mx-auto grid max-w-7xl gap-4 px-4 py-4 ${view === "quote" && quoteStep !== "finalize" ? "lg:grid-cols-[320px_minmax(0,1fr)]" : ""}`}>
        {view === "home" ? <HomePage user={sessionUser} meta={meta} lines={activeLines} total={totals.total} drafts={userDraftQuotes} onContinue={goToQuote} onLoadDraft={loadDraftQuote} /> : null}
        {view === "quote" ? (
          <>
            {quoteStep !== "finalize" ? (
              <CatalogPanel items={visibleItems} categories={catalogCategories} category={category} search={search} setSearch={setSearch} setCategory={setCategory} onAdd={addItem} />
            ) : null}
            <QuoteWorkspace
              step={quoteStep}
              setStep={setQuoteStep}
              lines={activeLines}
              meta={meta}
              setMeta={setMeta}
              totals={totals}
              items={activeItems}
              templates={templates}
              onAddTemplate={addTemplate}
              onStartFresh={startFresh}
              onAddItemToPackage={addItem}
              onUpdateLine={updateLine}
              onRenamePackage={renamePackage}
              onRemoveLine={(id) => setLines((current) => current.filter((line) => line.lineId !== id))}
              onSave={saveQuote}
              saveError={quoteSaveError}
              onPrint={printQuote}
              onEmail={() => {
                setPendingEmail(meta.email);
                setEmailPromptOpen(true);
              }}
            />
          </>
        ) : null}

        {view === "items" ? <ItemsPage items={activeItems} setItems={setItems} onDeleteItem={deleteItemEverywhere} /> : null}
        {view === "templates" ? <TemplatesPage templates={templates} items={activeItems} user={sessionUser} setTemplates={setTemplates} onAddTemplate={addTemplate} /> : null}
        {view === "previous" ? (
          <PreviousQuotes
            quotes={activeQuotes}
            selectedQuote={selectedQuote}
            onSelectQuote={(quote) => {
              setSelectedQuote(quote);
              navigateToView("previous", quote);
            }}
            onClearQuote={() => setSelectedQuote(null)}
            onClientView={(quote) => {
              setSelectedQuote(quote);
              navigateToView("client", quote);
            }}
            onEdit={loadQuoteForEdit}
            onPrintQuote={printSavedQuote}
            setQuotes={setQuotes}
          />
        ) : null}
        {view === "client" ? <ClientQuoteView quote={selectedQuote} onPrintQuote={printSavedQuote} /> : null}
        {view === "settings" ? <SettingsPage settings={settings} setSettings={setSettings} onSync={syncServiceTitan} items={items} setItems={setItems} quotes={quotes} setQuotes={setQuotes} sessions={userSessions} currentDeviceId={deviceId} adminUnlocked={adminUnlocked} user={sessionUser} onSignOut={signOut} /> : null}
      </section>

      {startFreshPromptOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4" onClick={() => setStartFreshPromptOpen(false)}>
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black">Start fresh?</h2>
                <p className="mt-2 text-sm text-stone-600">There are items or customer details in the current quote. Save a temporary draft first or clear the workspace.</p>
              </div>
              <button className="icon-button" onClick={() => setStartFreshPromptOpen(false)} aria-label="Close start fresh prompt">
                <X size={18} />
              </button>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              <button className="button-ghost" onClick={() => setStartFreshPromptOpen(false)}>
                Continue current
              </button>
              <button
                className="button-secondary"
                onClick={() => {
                  saveDraftQuote();
                  clearCurrentQuote();
                  setStartFreshPromptOpen(false);
                }}
              >
                Temp save
              </button>
              <button
                className="button-primary"
                onClick={() => {
                  clearCurrentQuote();
                  setStartFreshPromptOpen(false);
                }}
              >
                Start fresh
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {emailPromptOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">Customer email</h2>
                <p className="mt-1 text-sm text-stone-600">Enter the customer email before generating the printable PDF.</p>
              </div>
              <button className="icon-button" onClick={() => setEmailPromptOpen(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <input className="input mt-4" value={pendingEmail} onChange={(event) => setPendingEmail(event.target.value)} placeholder="customer@example.com" />
            <button className="button-primary mt-4 w-full" onClick={sendEmail}>
              <Mail size={17} />
              Generate PDF for email
            </button>
          </div>
        </div>
      ) : null}
      <PrintQuoteDocument quote={printableQuote ?? { meta, lines: activeLines, totals }} />
    </main>
  );
}

function previousStep(step: QuoteStep): QuoteStep {
  if (step === "finalize") return "review";
  if (step === "review") return "customize";
  if (step === "customize") return "pick";
  return "pick";
}

function QuoteStageProgress({ steps, currentStep, setStep }: { steps: QuoteStep[]; currentStep: QuoteStep; setStep: (step: QuoteStep) => void }) {
  return (
    <div className="grid grid-cols-[auto_1fr_auto_1fr_auto_1fr_auto] items-start gap-2">
      {steps.map((step, index) => {
        const isActive = currentStep === step;
        return (
          <div key={step} className="contents">
            <button className="group grid justify-items-center gap-1" onClick={() => setStep(step)} aria-current={isActive ? "step" : undefined}>
              <span className={`grid size-9 place-items-center rounded-full border text-sm font-black transition ${isActive ? "border-teal-700 bg-teal-700 text-white" : "border-stone-300 bg-white text-stone-600 group-hover:border-teal-700 group-hover:text-teal-800"}`}>
                {index + 1}
              </span>
              <span className={`text-xs font-black capitalize ${isActive ? "text-teal-800" : "text-stone-500 group-hover:text-teal-800"}`}>{step}</span>
            </button>
            {index < steps.length - 1 ? <span className="mt-4 h-px min-w-5 bg-stone-300" /> : null}
          </div>
        );
      })}
    </div>
  );
}

function HomePage({ user, meta, lines, total, drafts, onContinue, onLoadDraft }: { user: SessionUser; meta: QuoteMeta; lines: QuoteLine[]; total: number; drafts: DraftQuote[]; onContinue: () => void; onLoadDraft: (draft: DraftQuote) => void }) {
  const hasDraft = lines.length > 0 || Boolean(meta.customer || meta.project);

  return (
    <section className="panel lg:col-span-2">
      <div className="panel-header">
        <div>
          <h2>Welcome back, {user.name}</h2>
          <p>Pick up ongoing quote work or start from the quote workspace.</p>
        </div>
      </div>
      <div className="grid gap-4 p-4">
        {hasDraft ? (
          <button className="rounded-lg border border-teal-200 bg-teal-50 p-4 text-left transition hover:border-teal-700 hover:bg-white" onClick={onContinue}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-black">{meta.customer || "Unsaved quote"}</p>
                <p className="mt-1 text-sm text-stone-600">{meta.project || "Ongoing quote draft"}</p>
                <p className="mt-2 text-sm text-stone-600">{lines.length} cart lines</p>
              </div>
              <strong className="text-xl">{money.format(total)}</strong>
            </div>
          </button>
        ) : (
          <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-8 text-center text-stone-500">No ongoing quote yet.</div>
        )}
        {drafts.length ? (
          <div className="grid gap-2">
            <p className="text-sm font-black uppercase tracking-normal text-stone-500">Draft quotes saved to {user.name}'s workspace</p>
            {drafts.slice(0, 5).map((draft) => (
              <button key={draft.id} className="rounded-lg border border-stone-200 bg-white p-3 text-left transition hover:border-teal-700 hover:bg-teal-50" onClick={() => onLoadDraft(draft)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-black">{draft.meta.customer || draft.meta.project || "Temporary quote"}</p>
                    <p className="mt-1 text-sm text-stone-600">{draft.lines.length} lines · {draft.kind === "current" ? "live draft" : "temp saved"} · {new Date(draft.updatedAt).toLocaleString()}</p>
                    {draft.deviceName ? <p className="mt-1 text-xs font-bold text-stone-500">{draft.deviceName}</p> : null}
                  </div>
                  <strong>{money.format(draft.total)}</strong>
                </div>
              </button>
            ))}
          </div>
        ) : null}
        <button className="button-primary w-fit" onClick={onContinue}>
          Open Quote Workspace
        </button>
      </div>
    </section>
  );
}

function PrintQuoteDocument({ quote }: { quote: PrintableQuote }) {
  const issuedDate = quote.createdAt ? new Date(quote.createdAt) : new Date();

  return (
    <section className="print-document">
      <div className="print-header">
        <div>
          <p className="print-brand">Quick Quote Builder</p>
          <h1>Quote</h1>
        </div>
        <div className="print-meta">
          <p><strong>Quote #</strong> {quote.meta.quoteNumber || "Draft"}</p>
          {quote.revisionNumber ? <p><strong>Revision</strong> {quote.revisionNumber}</p> : null}
          <p><strong>Date</strong> {issuedDate.toLocaleDateString()}</p>
        </div>
      </div>
      <div className="print-info-grid">
        <div>
          <p className="print-label">Customer</p>
          <p>{quote.meta.customer || "Customer name"}</p>
          <p>{quote.meta.email || ""}</p>
        </div>
        <div>
          <p className="print-label">Project</p>
          <p>{quote.meta.project || "Project name"}</p>
          {quote.meta.location ? <p>{quote.meta.location}</p> : null}
        </div>
      </div>
      {quote.meta.notes ? (
        <div className="print-notes">
          <p className="print-label">Notes</p>
          <p>{quote.meta.notes}</p>
        </div>
      ) : null}
      <table className="print-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>SKU</th>
            <th>Qty</th>
            <th>Unit</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {quote.lines.length ? (
            quote.lines.map((line) => (
              <tr key={line.lineId}>
                <td>
                  <strong>{line.packageName ?? line.name}</strong>
                  {line.packageName ? <span>{line.name}</span> : null}
                  {line.notes ? <small>{line.notes}</small> : null}
                </td>
                <td>{line.sku}</td>
                <td>{line.quantity}</td>
                <td>{money.format(line.unitPrice)}</td>
                <td>{money.format(line.quantity * line.unitPrice)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5}>No line items.</td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="print-summary">
        <SummaryRow label="Equipment" value={quote.totals.equipmentSubtotal} />
        {quote.totals.laborAmount ? <SummaryRow label="Labor" value={quote.totals.laborAmount} /> : null}
        <SummaryRow label="Margin" value={quote.totals.marginAmount} />
        <SummaryRow label="Tax" value={quote.totals.taxAmount} />
        <div className="print-total">
          <span>Total</span>
          <strong>{money.format(quote.totals.total)}</strong>
        </div>
      </div>
      <div className="print-footer">
        <p>Prepared for review. Pricing is valid as of the quote date unless otherwise noted.</p>
      </div>
    </section>
  );
}

function CartDropdown({
  lines,
  totals,
  onUpdateLine,
  onRenamePackage,
  onRemoveLine,
  onNext,
  onClose,
}: {
  lines: QuoteLine[];
  totals: QuoteTotals;
  onUpdateLine: (lineId: string, patch: Partial<QuoteLine>) => void;
  onRenamePackage: (packageName: string, nextName: string) => void;
  onRemoveLine: (lineId: string) => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const cartRows = useMemo(() => {
    const rows: Array<{ type: "line"; line: QuoteLine } | { type: "package"; packageName: string; lines: QuoteLine[] }> = [];
    const packageIndexes = new Map<string, number>();

    lines.forEach((line) => {
      if (!line.packageName) {
        rows.push({ type: "line", line });
        return;
      }

      const existingIndex = packageIndexes.get(line.packageName);
      if (existingIndex === undefined) {
        packageIndexes.set(line.packageName, rows.length);
        rows.push({ type: "package", packageName: line.packageName, lines: [line] });
        return;
      }

      const existingRow = rows[existingIndex];
      if (existingRow.type === "package") existingRow.lines.push(line);
    });

    return rows;
  }, [lines]);

  return (
    <div className="fixed inset-0 z-50 grid h-[100dvh] w-screen grid-rows-[auto_minmax(0,1fr)_auto_auto] gap-3 overflow-hidden rounded-none border border-stone-200 bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl md:absolute md:inset-auto md:right-0 md:top-12 md:h-auto md:max-h-[calc(100vh-7rem)] md:w-[min(390px,calc(100vw-1.5rem))] md:grid-rows-none md:overflow-auto md:rounded-lg md:pb-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-black">Shopping cart</p>
          <p className="text-sm text-stone-500">{lines.length} lines</p>
        </div>
        <button className="icon-button md:hidden" onClick={onClose} aria-label="Close shopping cart">
          <X size={18} />
        </button>
      </div>
      <div className="min-h-0 overflow-y-auto pr-1 md:pr-0">
        <div className="grid content-start gap-2">
        {cartRows.length ? (
          cartRows.map((row) =>
            row.type === "package" ? (
              <details key={row.packageName} className="group min-w-0 overflow-hidden rounded-lg border border-stone-200 bg-stone-50 p-3">
                <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-start gap-2 [&::-webkit-details-marker]:hidden">
                  <div className="min-w-0">
                    <p className="truncate font-black text-stone-950">{row.packageName}</p>
                  </div>
                  <button
                    className="grid size-8 place-items-center rounded-full text-stone-500 hover:bg-red-50 hover:text-red-800"
                    onClick={(event) => {
                      event.preventDefault();
                      row.lines.forEach((line) => onRemoveLine(line.lineId));
                    }}
                    aria-label={`Remove ${row.packageName}`}
                  >
                    <X size={16} />
                  </button>
                </summary>
                <div className="hidden gap-2 pt-3 group-open:grid md:group-hover:grid md:group-focus-within:grid">
                  <div className="grid min-w-0 gap-1 border-t border-stone-200 pt-3">
                    {row.lines.map((line) => (
                      <div key={line.lineId} className="grid min-w-0 grid-cols-[minmax(0,1fr)_64px] items-start gap-2 rounded-md bg-white p-2 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-bold">{line.name}</p>
                          <p className="truncate font-mono text-xs text-stone-500">{line.sku}</p>
                        </div>
                        <span className="min-w-0 truncate text-right font-black">Qty {line.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            ) : (
              <div key={row.line.lineId} className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 p-3">
                <div className="min-w-0">
                  <p className="truncate font-bold">{row.line.name}</p>
                  <div className="mt-2 inline-grid grid-cols-[32px_48px_32px] items-center overflow-hidden rounded-md border border-stone-200 bg-white">
                    <button className="grid size-8 place-items-center text-stone-700 hover:bg-stone-100" onClick={() => (row.line.quantity <= 1 ? onRemoveLine(row.line.lineId) : onUpdateLine(row.line.lineId, { quantity: row.line.quantity - 1 }))} aria-label={`Decrease ${row.line.name}`}>
                      <Minus size={14} />
                    </button>
                    <span className="text-center text-sm font-black">{row.line.quantity}</span>
                    <button className="grid size-8 place-items-center text-stone-700 hover:bg-stone-100" onClick={() => onUpdateLine(row.line.lineId, { quantity: row.line.quantity + 1 })} aria-label={`Increase ${row.line.name}`}>
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
                <button
                  className="grid size-8 place-items-center rounded-full text-stone-500 opacity-100 transition duration-200 hover:bg-red-50 hover:text-red-800 md:translate-x-2 md:text-stone-400 md:opacity-0 md:group-hover:translate-x-0 md:group-hover:opacity-100"
                  onClick={() => onRemoveLine(row.line.lineId)}
                  aria-label={`Remove ${row.line.name}`}
                >
                  <X size={16} />
                </button>
              </div>
            ),
          )
        ) : (
          <p className="rounded-lg border border-dashed border-stone-300 p-4 text-center text-sm text-stone-500">No items added yet.</p>
        )}
        </div>
      </div>
      <TotalsCard totals={totals} />
      <button className="button-primary" onClick={onNext}>
        Go to cart
      </button>
    </div>
  );
}

function CatalogPanel({
  items,
  categories,
  category,
  search,
  setSearch,
  setCategory,
  onAdd,
}: {
  items: CatalogItem[];
  categories: string[];
  category: string;
  search: string;
  setSearch: (value: string) => void;
  setCategory: (value: string) => void;
  onAdd: (item: CatalogItem) => void;
}) {
  const [filterOpen, setFilterOpen] = useState(false);
  const hasCategories = categories.some((item) => item !== "All");
  return (
    <aside className="panel h-fit">
      <div className="panel-header">
        <div>
          <h2>Item Catalog</h2>
          <p>Pick equipment, parts, and labor.</p>
        </div>
        <PackagePlus size={20} />
      </div>
      <div className="grid gap-3 p-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search items or SKU" />
          <button className={`icon-button ${filterOpen ? "border-teal-700 text-teal-800" : ""}`} onClick={() => setFilterOpen((open) => !open)} aria-label="Filter categories">
            <Menu size={18} />
          </button>
        </div>
        {filterOpen ? (
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-stone-200 bg-stone-50 p-2">
            {hasCategories ? (
              categories.map((item) => (
                <button
                  key={item}
                  className={`chip ${category === item ? "chip-active" : ""}`}
                  onClick={() => {
                    setCategory(item);
                    setFilterOpen(false);
                  }}
                >
                  {item}
                </button>
              ))
            ) : (
              <p className="col-span-2 rounded-md border border-dashed border-stone-300 bg-white p-3 text-center text-sm font-bold text-stone-500">No categories</p>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm">
            <span className="font-bold text-stone-600">Category</span>
            <strong>{hasCategories ? category : "None"}</strong>
          </div>
        )}
        <div className="grid max-h-[65vh] gap-2 overflow-auto pr-1">
          {items.map((item) => (
            <article key={item.id} className="rounded-lg border border-stone-200 bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black">{item.name}</p>
                  <p className="mt-1 font-mono text-xs text-stone-500">{item.sku}</p>
                </div>
                <button className="icon-button" onClick={() => onAdd(item)} aria-label={`Add ${item.name}`}>
                  <PackagePlus size={18} />
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="rounded-full bg-teal-50 px-2 py-1 font-bold text-teal-800">{item.category}</span>
                <span className="font-black">{money.format(item.unitPrice)}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </aside>
  );
}

function QuoteWorkspace(props: {
  step: QuoteStep;
  setStep: (step: QuoteStep) => void;
  lines: QuoteLine[];
  meta: QuoteMeta;
  setMeta: Dispatch<SetStateAction<QuoteMeta>>;
  totals: QuoteTotals;
  items: CatalogItem[];
  templates: QuoteTemplate[];
  onAddTemplate: (template: QuoteTemplate, jumpToCustomize?: boolean) => void;
  onStartFresh: () => void;
  onAddItemToPackage: (item: CatalogItem, packageName?: string, quantity?: number) => void;
  onUpdateLine: (lineId: string, patch: Partial<QuoteLine>) => void;
  onRenamePackage: (packageName: string, nextName: string) => void;
  onRemoveLine: (lineId: string) => void;
  onSave: () => void;
  saveError: string;
  onPrint: () => void;
  onEmail: () => void;
}) {
  const steps: QuoteStep[] = ["pick", "customize", "review", "finalize"];
  const [addedTemplateId, setAddedTemplateId] = useState<string | null>(null);

  const addTemplateFromPicker = (template: QuoteTemplate) => {
    if (addedTemplateId) return;
    setAddedTemplateId(template.id);
    props.onAddTemplate(template, false);
    window.setTimeout(() => {
      setAddedTemplateId(null);
      props.setStep("customize");
    }, 900);
  };

  return (
    <section className="grid gap-4">
      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>Quote Workspace</h2>
            <p>{props.step === "pick" ? "Start fresh or build from a saved template." : "Review cart details and finalize the quote."}</p>
          </div>
          <div className="hidden min-w-[360px] sm:block">
            <QuoteStageProgress steps={steps} currentStep={props.step} setStep={props.setStep} />
          </div>
        </div>
        <div className="grid gap-4 p-4">
          <div className="sm:hidden">
            <QuoteStageProgress steps={steps} currentStep={props.step} setStep={props.setStep} />
          </div>

          {props.step === "pick" ? (
            <div className="grid gap-4">
              <div className="grid gap-3 md:grid-cols-2">
                <button className="rounded-lg border border-stone-200 bg-stone-50 p-5 text-left transition hover:border-teal-700 hover:bg-teal-50" onClick={props.onStartFresh}>
                  <p className="font-black">Start Fresh</p>
                  <p className="mt-2 text-sm text-stone-600">Build a quote by adding catalog items from scratch.</p>
                </button>
                <div className="rounded-lg border border-stone-200 bg-stone-50 p-5">
                  <p className="font-black">From Templates</p>
                  <p className="mt-2 text-sm text-stone-600">Choose a saved setup to prefill the quote.</p>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {props.templates.length ? (
                  props.templates.map((template) => {
                    const isAdded = addedTemplateId === template.id;
                    return (
                      <button
                        key={template.id}
                        className={`rounded-lg border p-4 text-left transition ${isAdded ? "border-emerald-700 bg-emerald-50 text-emerald-950" : "border-stone-200 bg-white hover:border-teal-700 hover:bg-teal-50"}`}
                        onClick={() => addTemplateFromPicker(template)}
                        disabled={Boolean(addedTemplateId)}
                      >
                        <p className="font-black">{template.name}</p>
                        <p className="mt-2 text-sm text-stone-600">{template.description}</p>
                        <p className={`mt-4 text-sm font-bold ${isAdded ? "text-emerald-800" : "text-teal-800"}`}>{isAdded ? "Added to quote" : `${template.lines.length} preset lines`}</p>
                      </button>
                    );
                  })
                ) : (
                  <p className="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-5 text-center text-stone-500 md:col-span-3">No templates yet.</p>
                )}
              </div>
            </div>
          ) : null}

          {props.step === "customize" || props.step === "review" || props.step === "finalize" ? (
            <QuoteLines lines={props.lines} items={props.items} onAddItemToPackage={props.onAddItemToPackage} onUpdateLine={props.onUpdateLine} onRenamePackage={props.onRenamePackage} onRemoveLine={props.onRemoveLine} />
          ) : null}

          {props.step === "finalize" ? (
            <FinalizePanel meta={props.meta} setMeta={props.setMeta} totals={props.totals} onSave={props.onSave} saveError={props.saveError} onPrint={props.onPrint} onEmail={props.onEmail} />
          ) : null}
          {props.step !== "pick" ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-200 bg-stone-50 p-3">
              <button className="button-secondary" onClick={() => props.setStep(previousStep(props.step))}>
                Back
              </button>
              {props.step === "customize" ? (
                <button className="button-primary" onClick={() => props.setStep("review")}>
                  Next
                </button>
              ) : null}
              {props.step === "review" ? (
                <button className="button-primary" onClick={() => props.setStep("finalize")}>
                  Add to cart
                </button>
              ) : null}
              {props.step === "finalize" ? (
                <button className="button-primary" onClick={props.onPrint}>
                  <Printer size={17} />
                  Print
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function QuoteLines({
  lines,
  items,
  onAddItemToPackage,
  onUpdateLine,
  onRenamePackage,
  onRemoveLine,
}: {
  lines: QuoteLine[];
  items: CatalogItem[];
  onAddItemToPackage: (item: CatalogItem, packageName?: string, quantity?: number) => void;
  onUpdateLine: (lineId: string, patch: Partial<QuoteLine>) => void;
  onRenamePackage: (packageName: string, nextName: string) => void;
  onRemoveLine: (lineId: string) => void;
}) {
  const [packageSelector, setPackageSelector] = useState("");
  const rows = useMemo(() => {
    const result: Array<{ type: "package"; packageName: string; lines: QuoteLine[] } | { type: "line"; line: QuoteLine }> = [];
    const packageIndexes = new Map<string, number>();

    lines.forEach((line) => {
      if (!line.packageName) {
        result.push({ type: "line", line });
        return;
      }
      const existingIndex = packageIndexes.get(line.packageName);
      if (existingIndex === undefined) {
        packageIndexes.set(line.packageName, result.length);
        result.push({ type: "package", packageName: line.packageName, lines: [line] });
        return;
      }
      const existing = result[existingIndex];
      if (existing.type === "package") existing.lines.push(line);
    });

    return result;
  }, [lines]);

  if (!lines.length) {
    return <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-8 text-center text-stone-500">Add catalog items or choose a template to start.</div>;
  }
  return (
    <div className="grid gap-3">
      {rows.map((row) =>
        row.type === "package" ? (
          <details key={`package-${row.lines[0]?.lineId ?? row.packageName}`} className="overflow-hidden rounded-lg border border-teal-200 bg-teal-50">
            <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
              <div className="min-w-0">
                <p className="truncate font-black">{row.packageName}</p>
                <p className="mt-1 text-sm font-medium text-teal-900">{row.lines.length} items · Qty {row.lines.reduce((sum, line) => sum + line.quantity, 0)}</p>
              </div>
              <span className="font-black">{money.format(row.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0))}</span>
              <ChevronDown size={17} className="text-stone-500" />
            </summary>
            <div className="grid gap-3 border-t border-teal-200 p-4">
              <label className="field">
                <span>Setup nickname</span>
                <input className="input border-teal-200 bg-white font-black text-teal-950" value={row.packageName} onChange={(event) => onRenamePackage(row.packageName, event.target.value)} />
              </label>
              <div className="grid gap-2">
                {row.lines.map((line) => (
                  <QuoteLineEditor key={line.lineId} line={line} onUpdateLine={onUpdateLine} onRemoveLine={onRemoveLine} />
                ))}
              </div>
              <button className="button-secondary w-fit" onClick={() => setPackageSelector(row.packageName)}>
                <PackagePlus size={16} />
                Add more item
              </button>
            </div>
          </details>
        ) : (
          <details key={row.line.lineId} className="overflow-hidden rounded-lg border border-stone-200 bg-stone-50">
            <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
              <p className="truncate font-black">{row.line.name}</p>
              <span className="font-black">Qty {row.line.quantity}</span>
              <ChevronDown size={17} className="text-stone-500" />
            </summary>
            <div className="border-t border-stone-200 p-4">
              <QuoteLineEditor line={row.line} onUpdateLine={onUpdateLine} onRemoveLine={onRemoveLine} />
            </div>
          </details>
        ),
      )}
      {packageSelector ? (
        <TemplateItemSelector
          items={items}
          onCancel={() => setPackageSelector("")}
          onConfirm={(itemId) => {
            const item = items.find((candidate) => candidate.id === itemId);
            if (item) onAddItemToPackage(item, packageSelector, 1);
            setPackageSelector("");
          }}
        />
      ) : null}
    </div>
  );
}

function QuoteLineEditor({ line, onUpdateLine, onRemoveLine }: { line: QuoteLine; onUpdateLine: (lineId: string, patch: Partial<QuoteLine>) => void; onRemoveLine: (lineId: string) => void }) {
  return (
    <div className="grid gap-3 rounded-lg border border-stone-200 bg-white p-3 md:grid-cols-2">
      <label className="field md:col-span-2">
        <span>Item name</span>
        <input className="input" value={line.name} onChange={(event) => onUpdateLine(line.lineId, { name: event.target.value })} />
      </label>
      <label className="field">
        <span>Quantity</span>
        <input className="input" type="number" min={0} value={line.quantity} onChange={(event) => onUpdateLine(line.lineId, { quantity: Number(event.target.value) })} />
      </label>
      <label className="field">
        <span>Unit price</span>
        <input className="input" type="number" min={0} step="0.01" value={line.unitPrice} onChange={(event) => onUpdateLine(line.lineId, { unitPrice: Number(event.target.value) })} />
      </label>
      <label className="field md:col-span-2">
        <span>Notes</span>
        <p className="min-h-16 rounded-md border border-stone-200 bg-stone-50 p-3 text-sm font-medium text-stone-700">{line.notes || "No notes"}</p>
      </label>
      <div className="flex items-center justify-between gap-3 md:col-span-2">
        <strong>{money.format(line.quantity * line.unitPrice)}</strong>
        <button className="button-ghost" onClick={() => onRemoveLine(line.lineId)}>
          <Trash2 size={16} />
          Remove
        </button>
      </div>
    </div>
  );
}

function FinalizePanel({
  meta,
  setMeta,
  totals,
  onSave,
  saveError,
  onPrint,
  onEmail,
}: {
  meta: QuoteMeta;
  setMeta: Dispatch<SetStateAction<QuoteMeta>>;
  totals: QuoteTotals;
  onSave: () => void;
  saveError: string;
  onPrint: () => void;
  onEmail: () => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="field">
          <span>Customer</span>
          <input className="input" value={meta.customer} onChange={(event) => setMeta((current) => ({ ...current, customer: event.target.value }))} />
        </label>
        <label className="field">
          <span>Customer email</span>
          <input className="input" value={meta.email} onChange={(event) => setMeta((current) => ({ ...current, email: event.target.value }))} />
        </label>
        <label className="field">
          <span>Project</span>
          <input className="input" value={meta.project} onChange={(event) => setMeta((current) => ({ ...current, project: event.target.value }))} />
        </label>
        <label className="field">
          <span>Location</span>
          <input className="input" value={meta.location ?? ""} onChange={(event) => setMeta((current) => ({ ...current, location: event.target.value }))} />
        </label>
        <label className="field">
          <span>Quote number</span>
          <input className="input" value={meta.quoteNumber} onChange={(event) => setMeta((current) => ({ ...current, quoteNumber: event.target.value }))} />
        </label>
        <label className="field">
          <span>Margin %</span>
          <input className="input" type="number" value={meta.marginPercent} onChange={(event) => setMeta((current) => ({ ...current, marginPercent: Number(event.target.value) }))} />
        </label>
        <label className="field">
          <span>Tax %</span>
          <input className="input" type="number" value={meta.taxPercent} onChange={(event) => setMeta((current) => ({ ...current, taxPercent: Number(event.target.value) }))} />
        </label>
        <label className="flex items-center gap-3 rounded-lg border border-stone-200 bg-white p-3 md:col-span-2">
          <input type="checkbox" checked={meta.includeLabor} onChange={(event) => setMeta((current) => ({ ...current, includeLabor: event.target.checked }))} />
          <span className="font-bold">Include labor in quote total</span>
        </label>
        {meta.includeLabor ? (
          <div className="grid gap-3 rounded-lg border border-teal-200 bg-teal-50 p-3 md:col-span-2 md:grid-cols-2">
            <div className="md:col-span-2">
              <p className="font-black text-teal-950">Labor</p>
              <p className="mt-1 text-sm text-teal-900">Labor is calculated here instead of being added as a catalog item.</p>
            </div>
            <label className="field">
              <span>Hours</span>
              <input className="input" type="number" min={0} step="0.25" value={meta.laborHours ?? 0} onChange={(event) => setMeta((current) => ({ ...current, laborHours: Number(event.target.value) }))} />
            </label>
            <label className="field">
              <span>Hourly rate</span>
              <input className="input" type="number" min={0} step="0.01" value={meta.laborRate ?? 0} onChange={(event) => setMeta((current) => ({ ...current, laborRate: Number(event.target.value) }))} />
            </label>
          </div>
        ) : null}
        <label className="field md:col-span-2">
          <span>Extra instructions / notes</span>
          <textarea className="textarea" value={meta.notes ?? ""} onChange={(event) => setMeta((current) => ({ ...current, notes: event.target.value }))} placeholder="Installation notes, customer instructions, exclusions, or follow-up details" />
        </label>
      </div>
      <div className="grid gap-3">
        {saveError ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-900">{saveError}</p> : null}
        <TotalsCard totals={totals} />
        <button className="button-primary" onClick={onSave}>
          <Save size={17} />
          Save Quote
        </button>
        <button className="button-secondary" onClick={onEmail}>
          <Mail size={17} />
          Email PDF
        </button>
        <button className="button-secondary" onClick={onPrint}>
          <Printer size={17} />
          Print
        </button>
      </div>
    </div>
  );
}

function TotalsCard({ totals }: { totals: QuoteTotals }) {
  return (
    <div className="grid gap-2 rounded-lg border border-stone-200 bg-white p-4">
      <SummaryRow label="Equipment" value={totals.equipmentSubtotal} />
      {totals.laborAmount ? <SummaryRow label="Labor" value={totals.laborAmount} /> : null}
      <SummaryRow label="Margin" value={totals.marginAmount} />
      <SummaryRow label="Tax" value={totals.taxAmount} />
      <div className="mt-2 flex items-center justify-between border-t border-stone-200 pt-3 text-xl font-black">
        <span>Total</span>
        <span>{money.format(totals.total)}</span>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm text-stone-600">
      <span>{label}</span>
      <strong className="text-stone-950">{money.format(value)}</strong>
    </div>
  );
}

function exportQuote(quote: SavedQuote, format: ExportQuoteFormat) {
  if (format === "print" || format === "pdf") {
    window.print();
    return;
  }

  const revisionNumber = (quote.revisions?.length ?? 0) + 1;
  const isInstallList = format === "install";
  const rows = isInstallList ? [
    ["Quote", quote.meta.quoteNumber],
    ["Revision", String(revisionNumber)],
    ["Customer", quote.meta.customer],
    ["Project", quote.meta.project],
    ["Location", quote.meta.location ?? ""],
    ["Created", new Date(quote.createdAt).toLocaleString()],
    [],
    ["Item", "SKU", "Package", "Quantity", "Notes"],
    ...quote.lines.map((line) => [line.name, line.sku, line.packageName ?? "", String(line.quantity), line.notes]),
  ] : [
    ["Quote", quote.meta.quoteNumber],
    ["Revision", String(revisionNumber)],
    ["Customer", quote.meta.customer],
    ["Project", quote.meta.project],
    ["Location", quote.meta.location ?? ""],
    ["Created", new Date(quote.createdAt).toLocaleString()],
    [],
    ["Item", "SKU", "Package", "Quantity", "ADI MSRP", "Unit Price", "Line Total", "Notes"],
    ...quote.lines.map((line) => [line.name, line.sku, line.packageName ?? "", String(line.quantity), String(line.msrp ?? ""), String(line.unitPrice), String(line.quantity * line.unitPrice), line.notes]),
    [],
    ["Total", String(quote.total)],
  ];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${quote.meta.quoteNumber || "quote"}-${isInstallList ? "install-list" : "revision-" + revisionNumber}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function describeQuoteChanges(previous: { meta: QuoteMeta; lines: QuoteLine[]; total: number } | null, next: { meta: QuoteMeta; lines: QuoteLine[]; total: number }) {
  if (!previous) return ["Original saved version."];
  const changes: string[] = [];
  if (previous.meta.customer !== next.meta.customer) changes.push(`Customer changed from ${previous.meta.customer || "blank"} to ${next.meta.customer || "blank"}.`);
  if (previous.meta.project !== next.meta.project) changes.push(`Project changed from ${previous.meta.project || "blank"} to ${next.meta.project || "blank"}.`);
  if ((previous.meta.location ?? "") !== (next.meta.location ?? "")) changes.push("Location changed.");
  if ((previous.meta.notes ?? "") !== (next.meta.notes ?? "")) changes.push("Quote notes changed.");
  if (previous.lines.length !== next.lines.length) changes.push(`Line count changed from ${previous.lines.length} to ${next.lines.length}.`);
  next.lines.forEach((line) => {
    const oldLine = previous.lines.find((candidate) => candidate.lineId === line.lineId || candidate.itemId === line.itemId);
    if (!oldLine) {
      changes.push(`Added ${line.name} qty ${line.quantity}.`);
      return;
    }
    if (oldLine.quantity !== line.quantity) changes.push(`${line.name} quantity changed from ${oldLine.quantity} to ${line.quantity}.`);
    if (oldLine.unitPrice !== line.unitPrice) changes.push(`${line.name} unit price changed from ${money.format(oldLine.unitPrice)} to ${money.format(line.unitPrice)}.`);
    if ((oldLine.packageName ?? "") !== (line.packageName ?? "")) changes.push(`${line.name} setup nickname changed.`);
  });
  previous.lines.forEach((line) => {
    if (!next.lines.some((candidate) => candidate.lineId === line.lineId || candidate.itemId === line.itemId)) changes.push(`Removed ${line.name}.`);
  });
  if (previous.total !== next.total) changes.push(`Total changed from ${money.format(previous.total)} to ${money.format(next.total)}.`);
  return changes.length ? changes : ["No line, customer, project, note, or total changes detected."];
}

function buildQuoteHistory(quote: SavedQuote): QuoteHistoryEntry[] {
  const snapshots = [
    ...(quote.revisions ?? []).map((revision, index) => ({
      id: revision.id,
      label: `Revision ${index + 1}`,
      savedAt: revision.savedAt,
      editedByName: revision.editedByName ?? "Unknown",
      meta: revision.meta,
      lines: revision.lines,
      total: revision.total,
    })),
    {
      id: `${quote.id}-current`,
      label: `Revision ${(quote.revisions?.length ?? 0) + 1}`,
      savedAt: quote.updatedAt,
      editedByName: quote.updatedByName ?? "Unknown",
      meta: quote.meta,
      lines: quote.lines,
      total: quote.total,
    },
  ];

  return snapshots.map((entry, index) => ({
    ...entry,
    changes: describeQuoteChanges(index ? snapshots[index - 1] : null, entry),
  }));
}

function ItemsPage({
  items,
  setItems,
  onDeleteItem,
}: {
  items: CatalogItem[];
  setItems: Dispatch<SetStateAction<CatalogItem[]>>;
  onDeleteItem: (itemId: string) => string | null;
}) {
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sortMode, setSortMode] = useState<"category" | "name" | "price">("category");
  const [draftItem, setDraftItem] = useState<Omit<CatalogItem, "id">>({
    sku: "",
    name: "",
    category: "",
    unitPrice: 0,
    msrp: 0,
    vendor: "Manual",
    inventory: 0,
    notes: "",
  });
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<CatalogItem | null>(null);
  const [deleteItemError, setDeleteItemError] = useState("");
  const [categoryEditor, setCategoryEditor] = useState<{ target: "draft" | "item"; itemId?: string } | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const categories = useMemo(() => ["All", ...Array.from(new Set(items.map((item) => item.category).filter(Boolean))).sort((a, b) => a.localeCompare(b))], [items]);
  const itemCategoryOptions = categories.filter((option) => option !== "All");
  const adiQuery = `${draftItem.name} ${draftItem.sku}`.trim();
  const adiMatches = useMemo(() => {
    return adiCatalog
      .map((match) => ({ ...match, matchScore: fuzzyScore(adiQuery, match) }))
      .filter((match) => (match.matchScore ?? 0) >= 35)
      .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0))
      .slice(0, 3);
  }, [adiQuery]);
  const sortedItems = useMemo(() => {
    return items
      .filter((item) => categoryFilter === "All" || item.category === categoryFilter)
      .slice()
      .sort((a, b) => {
        if (sortMode === "price") return a.unitPrice - b.unitPrice;
        if (sortMode === "name") return a.name.localeCompare(b.name);
        return a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
      });
  }, [categoryFilter, items, sortMode]);
  useEffect(() => {
    if (categoryFilter !== "All" && !itemCategoryOptions.includes(categoryFilter)) {
      setCategoryFilter("All");
    }
  }, [categoryFilter, itemCategoryOptions]);
  const updateItem = (id: string, patch: Partial<CatalogItem>) => setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  const confirmDeleteItem = (id: string) => {
    const error = onDeleteItem(id);
    if (error) {
      setDeleteItemError(error);
      return;
    }
    setDeleteItemError("");
    setDeleteItem(null);
  };
  const openCategoryEditor = (target: "draft" | "item", itemId?: string) => {
    setCategoryEditor({ target, itemId });
    setNewCategoryName("");
  };
  const closeCategoryEditor = () => {
    setCategoryEditor(null);
    setNewCategoryName("");
  };
  const saveCategoryName = () => {
    const category = newCategoryName.trim();
    if (!category || !categoryEditor) return;
    if (categoryEditor.target === "draft") {
      setDraftItem((current) => ({ ...current, category }));
    } else if (categoryEditor.itemId) {
      updateItem(categoryEditor.itemId, { category });
    }
    closeCategoryEditor();
  };
  const applyAdiMatch = (match: AdiCatalogMatch) => {
    setDraftItem((current) => ({
      ...current,
      sku: match.sku,
      name: match.name,
      category: match.category,
      unitPrice: match.unitPrice,
      msrp: match.msrp,
      vendor: match.vendor,
      inventory: match.inventory,
      notes: match.notes,
    }));
  };
  const addDraftItem = () => {
    setItems((current) => [
      ...current,
      {
        ...draftItem,
        id: makeId("item"),
        sku: draftItem.sku || "NEW-SKU",
        name: draftItem.name || "New Item",
        category: draftItem.category,
      },
    ]);
    setDraftItem({
      sku: "",
      name: "",
      category: "",
      unitPrice: 0,
      msrp: 0,
      vendor: "Manual",
      inventory: 0,
      notes: "",
    });
    setAddItemOpen(false);
  };
  return (
    <section className="panel lg:col-span-2">
      <div className="panel-header">
        <div>
          <h2>Items</h2>
          <p>Full catalog view with editable pricing, MSRP, inventory, and notes.</p>
        </div>
        <button className="button-primary" onClick={() => setAddItemOpen(true)}>
          <PackagePlus size={17} />
          Add Item
        </button>
      </div>
      <div className="grid gap-3 p-4">
        <div className="grid gap-3 rounded-lg border border-stone-200 bg-stone-50 p-3 md:grid-cols-[minmax(0,1fr)_220px]">
          <label className="field">
            <span>Filter by category</span>
            <select className="input" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              {categories.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Sort</span>
            <select className="input" value={sortMode} onChange={(event) => setSortMode(event.target.value as "category" | "name" | "price")}>
              <option value="category">Category</option>
              <option value="name">Name</option>
              <option value="price">Unit price</option>
            </select>
          </label>
        </div>
        {sortedItems.map((item) => (
          <details key={item.id} className="rounded-lg border border-stone-200 bg-stone-50">
            <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
              <div>
                <p className="font-black">{item.name}</p>
                <p className="font-mono text-xs text-stone-500">{item.category || "No category"} / {item.sku}</p>
              </div>
              <strong>{money.format(item.unitPrice)}</strong>
            </summary>
            <div className="grid gap-3 border-t border-stone-200 p-4 md:grid-cols-3">
              <label className="field">
                <span>Name</span>
                <input className="input" value={item.name} onChange={(event) => updateItem(item.id, { name: event.target.value })} />
              </label>
              <label className="field">
                <span>SKU</span>
                <input className="input" value={item.sku} onChange={(event) => updateItem(item.id, { sku: event.target.value })} />
              </label>
              <label className="field">
                <span>Category</span>
                <select
                  className="input"
                  value={item.category || ""}
                  onChange={(event) => {
                    if (event.target.value === "__new__") {
                      openCategoryEditor("item", item.id);
                      return;
                    }
                    updateItem(item.id, { category: event.target.value });
                  }}
                >
                  {!item.category ? (
                    <option value="" disabled>
                      Add new category
                    </option>
                  ) : null}
                  {itemCategoryOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                  <option value="__new__">Add new category</option>
                </select>
              </label>
              <label className="field">
                <span>Unit price</span>
                <input className="input" type="number" value={item.unitPrice} onChange={(event) => updateItem(item.id, { unitPrice: Number(event.target.value) })} />
              </label>
              <label className="field">
                <span>ADI MSRP</span>
                <input className="input" type="number" value={item.msrp ?? 0} onChange={(event) => updateItem(item.id, { msrp: Number(event.target.value) })} />
              </label>
              <label className="field">
                <span>Inventory</span>
                <input className="input" type="number" value={item.inventory ?? 0} onChange={(event) => updateItem(item.id, { inventory: Number(event.target.value) })} />
              </label>
              <label className="field md:col-span-3">
                <span>Notes</span>
                <textarea className="textarea" value={item.notes ?? ""} onChange={(event) => updateItem(item.id, { notes: event.target.value })} placeholder="Optional item notes" />
              </label>
              <div className="flex justify-end md:col-span-3">
                <button
                  className="button-ghost text-red-800 hover:bg-red-100"
                  onClick={() => {
                    setDeleteItem(item);
                    setDeleteItemError("");
                  }}
                >
                  <Trash2 size={16} />
                  Delete item
                </button>
              </div>
            </div>
          </details>
        ))}
      </div>
      {addItemOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4" onClick={() => setAddItemOpen(false)}>
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-2xl font-black">Add Item</h3>
                <p className="mt-1 text-sm text-stone-600">Create a new catalog item for quoting.</p>
              </div>
              <button className="icon-button" onClick={() => setAddItemOpen(false)} aria-label="Close add item">
                <X size={18} />
              </button>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <label className="field">
                <span>Name</span>
                <input className="input" value={draftItem.name} onChange={(event) => setDraftItem((current) => ({ ...current, name: event.target.value }))} placeholder="Item name" />
              </label>
              <label className="field">
                <span>SKU</span>
                <input className="input" value={draftItem.sku} onChange={(event) => setDraftItem((current) => ({ ...current, sku: event.target.value }))} placeholder="SKU" />
              </label>
              {adiMatches.length ? (
                <div className="grid gap-2 rounded-lg border border-teal-200 bg-teal-50 p-3 md:col-span-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-teal-950">Possible ADI match</p>
                      <p className="text-xs font-medium text-teal-900">Trying to add one of these items?</p>
                    </div>
                    <span className="rounded-full bg-white px-2 py-1 text-xs font-black text-teal-900">Fuzzy search</span>
                  </div>
                  <div className="grid gap-2 md:grid-cols-3">
                    {adiMatches.map((match) => (
                      <button
                        key={match.sku}
                        type="button"
                        className="grid grid-cols-[76px_minmax(0,1fr)] gap-3 rounded-lg border border-teal-100 bg-white p-2 text-left transition hover:border-teal-700 hover:shadow-sm"
                        onClick={() => applyAdiMatch(match)}
                      >
                        <img className="h-16 w-20 rounded-md border border-stone-200 object-cover" src={match.imageUrl} alt={match.name} />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-black text-stone-950">{match.name}</span>
                          <span className="mt-1 block font-mono text-xs text-stone-500">{match.sku}</span>
                          <span className="mt-1 block text-xs font-bold text-stone-700">MSRP {money.format(match.msrp ?? 0)} / {match.matchScore}% match</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <label className="field">
                <span>Category</span>
                {itemCategoryOptions.length ? (
                <select
                  className="input"
                  value={draftItem.category || ""}
                  onChange={(event) => {
                    if (event.target.value === "__new__") {
                      openCategoryEditor("draft");
                      return;
                    }
                    setDraftItem((current) => ({ ...current, category: event.target.value }));
                  }}
                >
                  {!draftItem.category ? (
                    <option value="" disabled>
                      Add new category
                    </option>
                  ) : null}
                  {itemCategoryOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                  <option value="__new__">Add new category</option>
                </select>
                ) : (
                  <button type="button" className="button-secondary min-h-11 justify-start" onClick={() => openCategoryEditor("draft")}>
                    Add new category
                  </button>
                )}
              </label>
              <label className="field">
                <span>Unit price</span>
                <input className="input" type="number" value={draftItem.unitPrice} onChange={(event) => setDraftItem((current) => ({ ...current, unitPrice: Number(event.target.value) }))} />
              </label>
              <label className="field">
                <span>ADI MSRP</span>
                <input className="input" type="number" value={draftItem.msrp ?? 0} onChange={(event) => setDraftItem((current) => ({ ...current, msrp: Number(event.target.value) }))} />
              </label>
              <label className="field">
                <span>Inventory</span>
                <input className="input" type="number" value={draftItem.inventory ?? 0} onChange={(event) => setDraftItem((current) => ({ ...current, inventory: Number(event.target.value) }))} />
              </label>
              <label className="field md:col-span-3">
                <span>Notes</span>
                <textarea className="textarea" value={draftItem.notes ?? ""} onChange={(event) => setDraftItem((current) => ({ ...current, notes: event.target.value }))} placeholder="Optional item notes" />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="button-ghost" onClick={() => setAddItemOpen(false)}>
                Cancel
              </button>
              <button className="button-primary" onClick={addDraftItem}>
                <PackagePlus size={17} />
                Add item
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {categoryEditor ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/45 p-4" onClick={closeCategoryEditor}>
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-2xl font-black">Add Category</h3>
                <p className="mt-2 text-sm text-stone-600">Name the category you want to use for this item.</p>
              </div>
              <button className="icon-button" onClick={closeCategoryEditor} aria-label="Close category editor">
                <X size={18} />
              </button>
            </div>
            <label className="field mt-5">
              <span>Category name</span>
              <input className="input" autoFocus value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder="Example: Door Hardware" />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button className="button-ghost" onClick={closeCategoryEditor}>
                Cancel
              </button>
              <button className="button-primary" onClick={saveCategoryName} disabled={!newCategoryName.trim()}>
                Save category
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {deleteItem ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4" onClick={() => setDeleteItem(null)}>
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-2xl font-black text-red-900">Delete item?</h3>
                <p className="mt-2 text-sm text-stone-600">This removes {deleteItem.name} from the editable item database in this browser.</p>
              </div>
              <button className="icon-button" onClick={() => setDeleteItem(null)} aria-label="Cancel delete">
                <X size={18} />
              </button>
            </div>
            {deleteItemError ? <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-900">{deleteItemError}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <button className="button-ghost" onClick={() => setDeleteItem(null)}>
                Cancel
              </button>
              <button className="button-primary bg-red-700 hover:bg-red-800" onClick={() => confirmDeleteItem(deleteItem.id)}>
                <Trash2 size={16} />
                Confirm delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function TemplatesPage({
  templates,
  items,
  user,
  setTemplates,
  onAddTemplate,
}: {
  templates: QuoteTemplate[];
  items: CatalogItem[];
  user: SessionUser;
  setTemplates: Dispatch<SetStateAction<QuoteTemplate[]>>;
  onAddTemplate: (template: QuoteTemplate, jumpToCustomize?: boolean) => void;
}) {
  const [deleteTemplate, setDeleteTemplate] = useState<QuoteTemplate | null>(null);
  const [draftTemplate, setDraftTemplate] = useState<QuoteTemplate | null>(null);
  const [draftSelectorOpen, setDraftSelectorOpen] = useState(false);
  const confirmDeleteTemplate = () => {
    if (!deleteTemplate) return;
    setTemplates((current) => current.filter((template) => template.id !== deleteTemplate.id));
    setDeleteTemplate(null);
  };
  const addTemplateDraftLine = (itemId: string) => {
    setDraftTemplate((current) => {
      if (!current) return current;
      return {
        ...current,
        lines: current.lines.some((line) => line.itemId === itemId)
          ? current.lines.map((line) => (line.itemId === itemId ? { ...line, quantity: line.quantity + 1 } : line))
          : [...current.lines, { itemId, quantity: 1 }],
      };
    });
  };
  const saveDraftTemplate = () => {
    if (!draftTemplate) return;
    setTemplates((current) => [
      ...current,
      {
        ...draftTemplate,
        name: draftTemplate.name || "New Template",
        createdBy: draftTemplate.createdBy ?? user.id,
        createdByName: draftTemplate.createdByName ?? user.name,
        updatedBy: user.id,
        updatedByName: user.name,
        collaborators: draftTemplate.collaborators ?? [],
      },
    ]);
    setDraftTemplate(null);
  };

  return (
    <section className="panel lg:col-span-2">
      <div className="panel-header">
        <div>
          <h2>Templates</h2>
          <p>Build reusable quote packages from the live item database.</p>
        </div>
        <button
          className="button-primary"
          onClick={() =>
            setDraftTemplate({
              id: makeId("template"),
              name: "",
              description: "",
              lines: [],
              createdBy: user.id,
              createdByName: user.name,
              updatedBy: user.id,
              updatedByName: user.name,
              collaborators: [],
            })
          }
        >
          <PackagePlus size={17} />
          Add Template
        </button>
      </div>
      <div className="grid gap-3 p-4 md:grid-cols-3">
        {templates.length ? (
          templates.map((template) => (
            <TemplateCard key={template.id} template={template} items={items} user={user} setTemplates={setTemplates} onAddTemplate={onAddTemplate} onDeleteTemplate={setDeleteTemplate} />
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-8 text-center text-stone-500 md:col-span-3">No templates yet.</div>
        )}
      </div>
      {deleteTemplate ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4" onClick={() => setDeleteTemplate(null)}>
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-2xl font-black text-red-900">Delete template?</h3>
                <p className="mt-2 text-sm text-stone-600">This removes {deleteTemplate.name || "this template"} from the template list.</p>
              </div>
              <button className="icon-button hover:border-red-700 hover:text-red-800" onClick={() => setDeleteTemplate(null)} aria-label="Cancel template delete">
                <X size={18} />
              </button>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="button-ghost" onClick={() => setDeleteTemplate(null)}>
                Cancel
              </button>
              <button className="button-primary bg-red-700 hover:bg-red-800" onClick={confirmDeleteTemplate}>
                <Trash2 size={16} />
                Confirm delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {draftTemplate ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4" onClick={() => setDraftTemplate(null)}>
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-2xl font-black">Create Template</h3>
                <p className="mt-1 text-sm text-stone-600">Build a reusable item list before saving it to templates.</p>
              </div>
              <button className="icon-button" onClick={() => setDraftTemplate(null)} aria-label="Close create template">
                <X size={18} />
              </button>
            </div>
            <div className="mt-5 grid gap-3">
              <label className="field">
                <span>Template name</span>
                <input className="input" value={draftTemplate.name} onChange={(event) => setDraftTemplate((current) => (current ? { ...current, name: event.target.value } : current))} placeholder="One door setup" />
              </label>
              <label className="field">
                <span>Description</span>
                <textarea className="textarea" value={draftTemplate.description} onChange={(event) => setDraftTemplate((current) => (current ? { ...current, description: event.target.value } : current))} placeholder="Template notes or use case" />
              </label>
              <div className="grid gap-2 rounded-lg border border-stone-200 bg-stone-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-black">Template items</p>
                  <button className="button-secondary" onClick={() => setDraftSelectorOpen(true)}>
                    <PackagePlus size={16} />
                    Add item to list
                  </button>
                </div>
                {draftTemplate.lines.length ? (
                  draftTemplate.lines.map((line) => {
                    const item = items.find((candidate) => candidate.id === line.itemId);
                    if (!item) return null;
                    return (
                      <div key={line.itemId} className="grid grid-cols-[minmax(0,1fr)_76px_auto] items-center gap-2 rounded-md bg-white p-2 text-sm">
                        <span className="truncate font-bold">{item.name}</span>
                        <input
                          className="input min-h-9"
                          type="number"
                          min={1}
                          value={line.quantity}
                          onChange={(event) =>
                            setDraftTemplate((current) =>
                              current
                                ? {
                                    ...current,
                                    lines: current.lines.map((candidate) => (candidate.itemId === line.itemId ? { ...candidate, quantity: Number(event.target.value) } : candidate)),
                                  }
                                : current,
                            )
                          }
                        />
                        <button className="button-ghost" onClick={() => setDraftTemplate((current) => (current ? { ...current, lines: current.lines.filter((candidate) => candidate.itemId !== line.itemId) } : current))} aria-label={`Remove ${item.name}`}>
                          <X size={16} />
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <p className="rounded-lg border border-dashed border-stone-300 bg-white p-5 text-center text-stone-500">No items added yet.</p>
                )}
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="button-ghost" onClick={() => setDraftTemplate(null)}>
                Cancel
              </button>
              <button className="button-primary" onClick={saveDraftTemplate}>
                Save Template
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {draftSelectorOpen ? (
        <TemplateItemSelector
          items={items}
          onCancel={() => setDraftSelectorOpen(false)}
          onConfirm={(itemId) => {
            addTemplateDraftLine(itemId);
            setDraftSelectorOpen(false);
          }}
        />
      ) : null}
    </section>
  );
}

function TemplateCard({
  template,
  items,
  user,
  setTemplates,
  onAddTemplate,
  onDeleteTemplate,
}: {
  template: QuoteTemplate;
  items: CatalogItem[];
  user: SessionUser;
  setTemplates: Dispatch<SetStateAction<QuoteTemplate[]>>;
  onAddTemplate: (template: QuoteTemplate, jumpToCustomize?: boolean) => void;
  onDeleteTemplate: (template: QuoteTemplate) => void;
}) {
  const [selectorOpen, setSelectorOpen] = useState(false);
  const updateTemplate = (patch: Partial<QuoteTemplate>) => {
    setTemplates((current) =>
      current.map((candidate) => {
        if (candidate.id !== template.id) return candidate;
        const collaborators = candidate.createdBy && candidate.createdBy !== user.id ? Array.from(new Set([...(candidate.collaborators ?? []), user.name])) : candidate.collaborators ?? [];
        return { ...candidate, ...patch, updatedBy: user.id, updatedByName: user.name, collaborators };
      }),
    );
  };
  const addTemplateLine = (itemId: string) => {
    updateTemplate({
      lines: template.lines.some((line) => line.itemId === itemId)
        ? template.lines.map((line) => (line.itemId === itemId ? { ...line, quantity: line.quantity + 1 } : line))
        : [...template.lines, { itemId, quantity: 1 }],
    });
  };
  const requirements = useMemo(() => getDoorTemplateRequirements(template), [template]);
  const requirementStatus = useMemo(() => {
    return requirements.map((requirement) => {
      const quantityInTemplate = template.lines.reduce((sum, line) => {
        const item = items.find((candidate) => candidate.id === line.itemId);
        return item && itemMatchesRequirement(item, requirement) ? sum + line.quantity : sum;
      }, 0);
      const suggestedItem = items.find((item) => itemMatchesRequirement(item, requirement));
      return {
        ...requirement,
        quantityInTemplate,
        missingQuantity: Math.max(requirement.quantity - quantityInTemplate, 0),
        suggestedItem,
      };
    });
  }, [items, requirements, template.lines]);
  const addMissingRequirement = (requirement: (typeof requirementStatus)[number]) => {
    if (!requirement.suggestedItem || !requirement.missingQuantity) return;
    updateTemplate({
      lines: template.lines.some((line) => line.itemId === requirement.suggestedItem?.id)
        ? template.lines.map((line) => (line.itemId === requirement.suggestedItem?.id ? { ...line, quantity: line.quantity + requirement.missingQuantity } : line))
        : [...template.lines, { itemId: requirement.suggestedItem.id, quantity: requirement.missingQuantity }],
    });
  };

  return (
    <article className="rounded-lg border border-stone-200 bg-stone-50">
      <details>
        <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
          <div className="min-w-0">
            <p className="truncate font-black">{template.name || "None"}</p>
            <p className="mt-1 text-xs font-bold text-stone-500">
              Created by {template.createdByName ?? "User"}
              {template.updatedByName && template.updatedByName !== template.createdByName ? ` / Collaborator: ${template.updatedByName}` : ""}
            </p>
            <p className="mt-1 text-sm text-stone-600">{template.lines.length} items · Qty {template.lines.reduce((sum, line) => sum + line.quantity, 0)}</p>
          </div>
          <button
            className="button-primary min-h-9 px-3 py-1"
            onClick={(event) => {
              event.preventDefault();
              onAddTemplate(template);
            }}
          >
            Add
          </button>
          <ChevronDown size={17} className="text-stone-500" />
        </summary>
        <div className="grid gap-3 border-t border-stone-200 p-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <input className="input font-black" value={template.name} onChange={(event) => updateTemplate({ name: event.target.value })} />
            <button
              className="icon-button hover:border-red-200 hover:bg-red-50 hover:text-red-800"
              onClick={() => onDeleteTemplate(template)}
              aria-label={`Delete ${template.name || "template"}`}
            >
              <X size={16} />
            </button>
          </div>
          <textarea className="textarea" value={template.description} onChange={(event) => updateTemplate({ description: event.target.value })} placeholder="Template description" />
          <div className="grid gap-2 rounded-lg border border-stone-200 bg-white p-3 text-sm text-stone-600">
            <p><strong className="text-stone-950">Creator:</strong> {template.createdByName ?? "User"}</p>
            <p><strong className="text-stone-950">Last updated by:</strong> {template.updatedByName ?? template.createdByName ?? "User"}</p>
            <p><strong className="text-stone-950">Collaborators:</strong> {template.collaborators?.length ? template.collaborators.join(", ") : "None"}</p>
          </div>
          {requirements.length ? (
        <div className="grid gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div>
            <p className="text-sm font-black text-amber-950">Door template check</p>
            <p className="text-xs font-medium text-amber-900">Checks common door access prerequisites from the item database.</p>
          </div>
          <div className="grid gap-2">
            {requirementStatus.map((requirement) => (
              <div key={requirement.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md bg-white p-2 text-sm">
                <div className="min-w-0">
                  <p className="font-bold text-stone-950">{requirement.label}</p>
                  <p className="text-xs text-stone-600">
                    Need {requirement.quantity}, has {requirement.quantityInTemplate}
                    {requirement.missingQuantity ? requirement.suggestedItem ? ` / can add ${requirement.suggestedItem.name}` : " / no matching catalog item" : " / complete"}
                  </p>
                </div>
                {requirement.missingQuantity ? (
                  <button className="button-secondary min-h-9 px-3 py-1" onClick={() => addMissingRequirement(requirement)} disabled={!requirement.suggestedItem}>
                    Add
                  </button>
                ) : (
                  <span className="rounded-md bg-teal-50 px-2 py-1 text-xs font-black text-teal-800">OK</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="grid gap-2">
        {template.lines.map((line) => {
          const item = items.find((candidate) => candidate.id === line.itemId);
          if (!item) return null;
          return (
            <div key={`${template.id}-${line.itemId}`} className="grid grid-cols-[minmax(0,1fr)_76px_auto] items-center gap-2 rounded-md bg-white p-2 text-sm">
              <span className="truncate font-bold">{item.name}</span>
              <input
                className="input min-h-9"
                type="number"
                min={1}
                value={line.quantity}
                onChange={(event) =>
                  updateTemplate({
                    lines: template.lines.map((candidate) => (candidate.itemId === line.itemId ? { ...candidate, quantity: Number(event.target.value) } : candidate)),
                  })
                }
              />
              <button className="button-ghost" onClick={() => updateTemplate({ lines: template.lines.filter((candidate) => candidate.itemId !== line.itemId) })} aria-label={`Remove ${item.name}`}>
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
      <button className="button-secondary w-full justify-start" onClick={() => setSelectorOpen(true)}>
        <PackagePlus size={16} />
        Add item to list
      </button>
        </div>
      </details>
      {selectorOpen ? (
        <TemplateItemSelector
          items={items}
          onCancel={() => setSelectorOpen(false)}
          onConfirm={(itemId) => {
            addTemplateLine(itemId);
            setSelectorOpen(false);
          }}
        />
      ) : null}
    </article>
  );
}

function TemplateItemSelector({ items, onCancel, onConfirm }: { items: CatalogItem[]; onCancel: () => void; onConfirm: (itemId: string) => void }) {
  const categories = useMemo(() => Array.from(new Set(items.map((item) => item.category || "Uncategorized"))).sort((a, b) => a.localeCompare(b)), [items]);
  const [category, setCategory] = useState(categories[0] ?? "");
  const [selectedItemId, setSelectedItemId] = useState("");
  const visibleItems = useMemo(() => items.filter((item) => (item.category || "Uncategorized") === category), [category, items]);

  useEffect(() => {
    if ((!category || !categories.includes(category)) && categories[0]) setCategory(categories[0]);
  }, [categories, category]);

  useEffect(() => {
    if (!visibleItems.some((item) => item.id === selectedItemId)) {
      setSelectedItemId(visibleItems[0]?.id ?? "");
    }
  }, [selectedItemId, visibleItems]);

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/45 p-4" onClick={onCancel}>
      <div className="max-h-[calc(100vh-2rem)] w-full max-w-4xl overflow-y-auto rounded-lg bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-2xl font-black">Add Item to List</h3>
            <p className="mt-1 text-sm text-stone-600">Pick a category, then choose the item to add to this template.</p>
          </div>
          <button className="icon-button" onClick={onCancel} aria-label="Close item selector">
            <X size={18} />
          </button>
        </div>
        <div className="mt-5 grid min-h-[360px] gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
          <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
            <p className="mb-3 text-xs font-bold uppercase tracking-normal text-stone-500">Categories</p>
            <div className="grid gap-2">
              {categories.length ? (
                categories.map((item) => (
                  <button key={item} className={`rounded-md px-3 py-2 text-left text-sm font-bold ${category === item ? "bg-white text-teal-800 shadow-sm" : "hover:bg-white"}`} onClick={() => setCategory(item)}>
                    {item}
                  </button>
                ))
              ) : (
                <p className="rounded-md border border-dashed border-stone-300 bg-white p-3 text-sm text-stone-500">No categories</p>
              )}
            </div>
          </div>
          <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
            <p className="mb-3 text-xs font-bold uppercase tracking-normal text-stone-500">Items</p>
            <div className="grid max-h-[52vh] gap-2 overflow-auto pr-1">
              {visibleItems.length ? (
                visibleItems.map((item) => (
                  <button key={item.id} className={`rounded-lg border p-3 text-left ${selectedItemId === item.id ? "border-teal-700 bg-teal-50" : "border-stone-200 bg-white"}`} onClick={() => setSelectedItemId(item.id)}>
                    <p className="font-black">{item.name}</p>
                    <p className="mt-1 font-mono text-xs text-stone-500">{item.sku}</p>
                    <p className="mt-2 text-sm font-bold">{money.format(item.unitPrice)}</p>
                  </button>
                ))
              ) : (
                <p className="rounded-md border border-dashed border-stone-300 bg-white p-6 text-center text-stone-500">No items in this category.</p>
              )}
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="button-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button className="button-primary" onClick={() => selectedItemId && onConfirm(selectedItemId)} disabled={!selectedItemId}>
            Add item
          </button>
        </div>
      </div>
    </div>
  );
}

function PreviousQuotes({
  quotes,
  selectedQuote,
  onSelectQuote,
  onClearQuote,
  onClientView,
  onEdit,
  onPrintQuote,
  setQuotes,
}: {
  quotes: SavedQuote[];
  selectedQuote: SavedQuote | null;
  onSelectQuote: (quote: SavedQuote) => void;
  onClearQuote: () => void;
  onClientView: (quote: SavedQuote) => void;
  onEdit: (quote: SavedQuote) => void;
  onPrintQuote: (quote: SavedQuote) => void;
  setQuotes: Dispatch<SetStateAction<SavedQuote[]>>;
}) {
  const [deleteQuote, setDeleteQuote] = useState<SavedQuote | null>(null);
  const [printMenuOpen, setPrintMenuOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [quoteSearch, setQuoteSearch] = useState("");
  const historyEntries = useMemo(() => (selectedQuote ? buildQuoteHistory(selectedQuote) : []), [selectedQuote]);
  const selectedHistory = historyEntries[historyIndex] ?? historyEntries[historyEntries.length - 1];
  const visibleQuotes = useMemo(() => {
    const query = normalizeSearchValue(quoteSearch);
    if (!query) return quotes;
    return quotes.filter((quote) => {
      const searchable = normalizeSearchValue(`${quote.meta.customer} ${quote.meta.project} ${quote.meta.location ?? ""} ${quote.meta.quoteNumber} ${quote.lines.map((line) => `${line.name} ${line.sku}`).join(" ")}`);
      return searchable.includes(query);
    });
  }, [quoteSearch, quotes]);
  const confirmDeleteQuote = () => {
    if (!deleteQuote) return;
    const deletedAt = new Date().toISOString();
    setQuotes((current) => current.map((quote) => (quote.id === deleteQuote.id ? { ...quote, deletedAt, updatedAt: deletedAt } : quote)));
    if (selectedQuote?.id === deleteQuote.id) onClearQuote();
    setDeleteQuote(null);
  };

  useEffect(() => {
    setHistoryOpen(false);
    setHistoryIndex(0);
  }, [selectedQuote?.id]);

  return (
    <section className="grid gap-4 lg:col-span-2 lg:grid-cols-[360px_minmax(0,1fr)]">
      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>Previous Quotes</h2>
            <p>Open a saved quote summary without starting a new one.</p>
          </div>
        </div>
        <div className="grid gap-2 p-4">
          <input className="input" value={quoteSearch} onChange={(event) => setQuoteSearch(event.target.value)} placeholder="Search customer, project, location, quote, or item" />
          {visibleQuotes.length ? (
            visibleQuotes.map((quote) => (
              <button key={quote.id} className={`rounded-lg border p-3 text-left ${selectedQuote?.id === quote.id ? "border-teal-700 bg-teal-50" : "border-stone-200 bg-white"}`} onClick={() => onSelectQuote(quote)}>
                <p className="font-black">{quote.meta.customer || "Unnamed customer"}</p>
                <p className="text-sm text-stone-600">{new Date(quote.createdAt).toLocaleDateString()} · {quote.meta.quoteNumber}</p>
                {quote.meta.project ? <p className="text-sm font-bold text-stone-700">{quote.meta.project}</p> : null}
                {quote.meta.location ? <p className="text-sm text-stone-600">{quote.meta.location}</p> : null}
                <p className="mt-2 font-black">{money.format(quote.total)}</p>
              </button>
            ))
          ) : (
            <p className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-stone-500">{quotes.length ? "No quotes match that search." : "No saved quotes yet."}</p>
          )}
        </div>
      </div>
      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>Quote Summary</h2>
            <p>Shopping-cart style summary with the original quote date and price.</p>
          </div>
        </div>
        <div className="p-4">
          {selectedQuote ? (
            <div className="grid gap-4">
              <div className="rounded-lg bg-stone-50 p-4">
                <p className="font-black">{selectedQuote.meta.customer || "Unnamed customer"}</p>
                <p className="text-sm text-stone-600">Quote {selectedQuote.meta.quoteNumber} · Quoted {new Date(selectedQuote.createdAt).toLocaleString()}</p>
                <p className="text-sm text-stone-600">Revision {(selectedQuote.revisions?.length ?? 0) + 1}</p>
                {selectedQuote.meta.project ? <p className="mt-1 text-sm font-bold text-stone-700">{selectedQuote.meta.project}</p> : null}
                {selectedQuote.meta.location ? <p className="text-sm text-stone-600">{selectedQuote.meta.location}</p> : null}
              </div>
              <div className="grid gap-2">
                {selectedQuote.lines.map((line) => (
                  <div key={line.lineId} className="flex items-start justify-between gap-3 rounded-lg border border-stone-200 bg-white p-3">
                    <div>
                      <p className="font-bold">{line.packageName ?? line.name}</p>
                      {line.packageName ? <p className="text-sm text-stone-600">{line.name}</p> : null}
                      <p className="text-sm text-stone-600">Qty {line.quantity}</p>
                    </div>
                    <strong>{money.format(line.quantity * line.unitPrice)}</strong>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button className="button-ghost" onClick={() => setDeleteQuote(selectedQuote)}>
                  <Trash2 size={16} />
                  Remove
                </button>
                <div className="ml-auto flex flex-wrap gap-2">
                  <button className="button-primary" onClick={() => onEdit(selectedQuote)}>
                    Edit Quote
                  </button>
                  <button className="button-secondary" onClick={() => onClientView(selectedQuote)}>
                    Client View
                  </button>
                  <button
                    className="button-secondary"
                    onClick={() => {
                      setHistoryIndex(Math.max(buildQuoteHistory(selectedQuote).length - 1, 0));
                      setHistoryOpen((open) => !open);
                    }}
                  >
                    <History size={16} />
                    Time wheel
                  </button>
                  <div className="relative">
                    <button className="button-secondary" onClick={() => setPrintMenuOpen((open) => !open)}>
                      <Printer size={16} />
                      Print
                      <ChevronDown size={16} />
                    </button>
                    {printMenuOpen ? (
                      <div className="absolute right-0 top-12 z-20 grid w-52 gap-1 rounded-lg border border-stone-200 bg-white p-2 shadow-xl before:absolute before:-top-2 before:right-6 before:size-4 before:rotate-45 before:border-l before:border-t before:border-stone-200 before:bg-white">
                        {[
                          ["print", "Print"],
                          ["pdf", "PDF"],
                          ["excel", "Excel with MSRP"],
                          ["install", "Install list no prices"],
                        ].map(([format, label]) => (
                          <button
                            key={format}
                            className="rounded-md px-3 py-2 text-left text-sm font-bold hover:bg-stone-100"
                            onClick={() => {
                              if (format === "excel" || format === "install") {
                                exportQuote(selectedQuote, format as ExportQuoteFormat);
                              } else {
                                onPrintQuote(selectedQuote);
                              }
                              setPrintMenuOpen(false);
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
              {historyOpen && selectedHistory ? (
                <div className="grid gap-3 rounded-lg border border-stone-200 bg-stone-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-black">Quote time wheel</p>
                      <p className="text-sm text-stone-600">See each saved version, who edited it, and what changed.</p>
                    </div>
                    <span className="rounded-full bg-white px-2 py-1 text-xs font-black text-stone-600">{historyEntries.length} version{historyEntries.length === 1 ? "" : "s"}</span>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
                    <div className="grid content-start gap-2">
                      {historyEntries.map((entry, index) => (
                        <button key={entry.id} className={`rounded-lg border p-3 text-left ${historyIndex === index ? "border-teal-700 bg-white text-teal-950" : "border-stone-200 bg-white/70 hover:bg-white"}`} onClick={() => setHistoryIndex(index)}>
                          <p className="font-black">{entry.label}</p>
                          <p className="text-xs text-stone-600">{new Date(entry.savedAt).toLocaleString()}</p>
                          <p className="mt-1 text-xs font-bold text-stone-700">By {entry.editedByName}</p>
                        </button>
                      ))}
                    </div>
                    <div className="grid gap-3 rounded-lg border border-stone-200 bg-white p-3">
                      <div className="grid gap-2 md:grid-cols-3">
                        <InfoTile label="Customer" value={selectedHistory.meta.customer || "Blank"} />
                        <InfoTile label="Project" value={selectedHistory.meta.project || "Blank"} />
                        <InfoTile label="Total" value={money.format(selectedHistory.total)} />
                      </div>
                      <div>
                        <p className="font-black">Changes</p>
                        <ul className="mt-2 grid gap-1 text-sm text-stone-600">
                          {selectedHistory.changes.map((change, index) => (
                            <li key={`${change}-${index}`} className="rounded-md bg-stone-50 px-3 py-2">{change}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="font-black">Items in this version</p>
                        <div className="mt-2 grid gap-2">
                          {selectedHistory.lines.map((line) => (
                            <div key={line.lineId} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-md bg-stone-50 p-2 text-sm">
                              <span className="truncate font-bold">{line.packageName ? `${line.packageName} / ${line.name}` : line.name}</span>
                              <span className="font-black">Qty {line.quantity}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-stone-300 p-10 text-center text-stone-500">Select a previous quote to view the cart summary.</p>
          )}
        </div>
      </div>
      {deleteQuote ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4" onClick={() => setDeleteQuote(null)}>
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-2xl font-black text-red-900">Delete quote?</h3>
                <p className="mt-2 text-sm text-stone-600">This hides the quote from previous quotes and moves it to Admin recovery.</p>
              </div>
              <button className="icon-button" onClick={() => setDeleteQuote(null)} aria-label="Cancel quote delete">
                <X size={18} />
              </button>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="button-ghost" onClick={() => setDeleteQuote(null)}>
                Cancel
              </button>
              <button className="button-primary bg-red-700 hover:bg-red-800" onClick={confirmDeleteQuote}>
                <Trash2 size={16} />
                Delete quote
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ClientQuoteView({ quote, onPrintQuote }: { quote: SavedQuote | null; onPrintQuote: (quote: SavedQuote) => void }) {
  if (!quote) {
    return (
      <section className="panel lg:col-span-2">
        <div className="panel-header">
          <div>
            <h2>Quote</h2>
            <p>This client quote link is loading or no longer exists.</p>
          </div>
        </div>
        <div className="p-6">
          <p className="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-8 text-center text-stone-500">Quote not found.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="panel lg:col-span-2">
      <div className="panel-header">
        <div>
          <h2>{quote.meta.project || quote.meta.customer || "Quote"}</h2>
          <p>Client view for quote {quote.meta.quoteNumber}.</p>
        </div>
        <button className="button-secondary" onClick={() => onPrintQuote(quote)}>
          <Printer size={16} />
          Print
        </button>
      </div>
      <div className="grid gap-4 p-4">
        <div className="grid gap-3 rounded-lg bg-stone-50 p-4 md:grid-cols-2">
          <InfoTile label="Customer" value={quote.meta.customer || "Customer"} />
          <InfoTile label="Project" value={quote.meta.project || "Project"} />
          <InfoTile label="Quote" value={quote.meta.quoteNumber} />
          <InfoTile label="Quoted" value={new Date(quote.createdAt).toLocaleDateString()} />
          {quote.meta.location ? <InfoTile label="Location" value={quote.meta.location} /> : null}
        </div>
        <div className="grid gap-2">
          {quote.lines.map((line) => (
            <div key={line.lineId} className="flex items-start justify-between gap-3 rounded-lg border border-stone-200 bg-white p-3">
              <div className="min-w-0">
                <p className="truncate font-bold">{line.packageName ?? line.name}</p>
                {line.packageName ? <p className="truncate text-sm text-stone-600">{line.name}</p> : null}
                <p className="text-sm text-stone-600">Qty {line.quantity}</p>
              </div>
              <strong className="shrink-0">{money.format(line.quantity * line.unitPrice)}</strong>
            </div>
          ))}
        </div>
        <TotalsCard totals={totalsFromSavedQuote(quote)} />
      </div>
    </section>
  );
}

function SettingsPage({
  settings,
  setSettings,
  onSync,
  items,
  setItems,
  quotes,
  setQuotes,
  sessions,
  currentDeviceId,
  adminUnlocked,
  user,
  onSignOut,
}: {
  settings: ServiceTitanSettings;
  setSettings: Dispatch<SetStateAction<ServiceTitanSettings>>;
  onSync: () => void;
  items: CatalogItem[];
  setItems: Dispatch<SetStateAction<CatalogItem[]>>;
  quotes: SavedQuote[];
  setQuotes: Dispatch<SetStateAction<SavedQuote[]>>;
  sessions: UserSessionRecord[];
  currentDeviceId: string;
  adminUnlocked: boolean;
  user: SessionUser;
  onSignOut: () => void;
}) {
  const [activeSection, setActiveSection] = useState<SettingsSection>("account");
  const [databaseStatus, setDatabaseStatus] = useState<DatabaseStatus | null>(null);
  const [syncConfirmOpen, setSyncConfirmOpen] = useState(false);
  const [recoverySearch, setRecoverySearch] = useState("");
  const [recoverySort, setRecoverySort] = useState<RecoverySort>("recent");
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<PermanentDeleteTarget | null>(null);
  const sections: { id: SettingsSection; label: string; admin?: boolean }[] = [
    { id: "account", label: "Account Info" },
    { id: "database", label: "Database" },
    { id: "serviceTitan", label: "ServiceTitan", admin: true },
    { id: "adi", label: "ADI MSRP", admin: true },
    { id: "sync", label: "Sync", admin: true },
    { id: "recovery", label: "Admin Recovery", admin: true },
  ];
  const visibleSections = sections.filter((section) => !section.admin || adminUnlocked);
  const deletedItems = useMemo(() => {
    const query = normalizeSearchValue(recoverySearch);
    const filtered = items.filter((item) => {
      if (!item.deletedAt) return false;
      if (!query) return true;
      return normalizeSearchValue(`${item.name} ${item.sku} ${item.category} ${item.vendor ?? ""}`).includes(query);
    });
    return [...filtered].sort((a, b) => (recoverySort === "name" ? a.name.localeCompare(b.name) : new Date(b.deletedAt ?? 0).getTime() - new Date(a.deletedAt ?? 0).getTime()));
  }, [items, recoverySearch, recoverySort]);
  const deletedQuotes = useMemo(() => {
    const query = normalizeSearchValue(recoverySearch);
    const filtered = quotes.filter((quote) => {
      if (!quote.deletedAt) return false;
      if (!query) return true;
      return normalizeSearchValue(`${quote.meta.customer} ${quote.meta.project} ${quote.meta.location ?? ""} ${quote.meta.quoteNumber}`).includes(query);
    });
    return [...filtered].sort((a, b) => (recoverySort === "name" ? (a.meta.customer || a.meta.project || a.meta.quoteNumber).localeCompare(b.meta.customer || b.meta.project || b.meta.quoteNumber) : new Date(b.deletedAt ?? 0).getTime() - new Date(a.deletedAt ?? 0).getTime()));
  }, [quotes, recoverySearch, recoverySort]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/db/status", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((status: DatabaseStatus | null) => {
        if (!cancelled) setDatabaseStatus(status);
      })
      .catch(() => {
        if (!cancelled) setDatabaseStatus(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!visibleSections.some((section) => section.id === activeSection)) {
      setActiveSection("account");
    }
  }, [activeSection, adminUnlocked]);

  const confirmSync = () => {
    onSync();
    setSyncConfirmOpen(false);
  };
  const recoverItem = (itemId: string) => setItems((current) => current.map((item) => (item.id === itemId ? { ...item, deletedAt: undefined } : item)));
  const recoverQuote = (quoteId: string) => {
    const updatedAt = new Date().toISOString();
    setQuotes((current) => current.map((quote) => (quote.id === quoteId ? { ...quote, deletedAt: undefined, updatedAt } : quote)));
  };
  const confirmPermanentDelete = () => {
    if (!permanentDeleteTarget) return;
    if (permanentDeleteTarget.kind === "item") {
      setItems((current) => current.filter((item) => item.id !== permanentDeleteTarget.id));
    } else {
      setQuotes((current) => current.filter((quote) => quote.id !== permanentDeleteTarget.id));
    }
    setPermanentDeleteTarget(null);
  };

  return (
    <section className="panel lg:col-span-2">
      <div className="panel-header">
        <div>
          <h2>Settings</h2>
          <p>Account, database, ServiceTitan, and future integration controls.</p>
        </div>
      </div>
      <div className="grid gap-4 p-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="grid h-fit gap-2 rounded-lg bg-stone-50 p-3">
          {visibleSections.map((item) => (
            <button key={item.id} className={`rounded-md px-3 py-2 text-left font-bold transition ${activeSection === item.id ? "bg-white text-teal-800 shadow-sm" : "hover:bg-white"}`} onClick={() => setActiveSection(item.id)}>
              {item.label}
            </button>
          ))}
          {!adminUnlocked ? <p className="rounded-md border border-dashed border-stone-300 bg-white p-3 text-xs font-bold text-stone-500">Hold the Settings nav button for 5 seconds to unlock admin sections.</p> : null}
        </div>
        <div className="grid gap-4">
          {activeSection === "account" ? (
            <section className="rounded-lg border border-stone-200 bg-stone-50 p-4">
              <h3 className="font-black">Account Info</h3>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="field">
                  <span>User</span>
                  <input className="input" value={user.name} readOnly />
                </label>
                <label className="field">
                  <span>Login provider</span>
                  <input className="input" value={user.provider === "azure" ? "Microsoft Azure SSO" : "Temporary password login"} readOnly />
                </label>
              </div>
              <button className="button-secondary mt-4" onClick={onSignOut}>
                <LogOut size={16} />
                Sign out
              </button>
              <div className="mt-5 grid gap-2">
                <div className="flex items-center gap-2">
                  <Monitor size={17} />
                  <h4 className="font-black">Logged-in devices</h4>
                </div>
                {sessions.length ? (
                  sessions.map((session) => (
                    <div key={session.id} className="rounded-lg border border-stone-200 bg-white p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-bold">{session.deviceName}</p>
                          <p className="text-sm text-stone-600">Last seen {new Date(session.lastSeenAt).toLocaleString()}</p>
                        </div>
                        {session.deviceId === currentDeviceId ? <span className="rounded-full bg-teal-100 px-2 py-1 text-xs font-black text-teal-900">Current</span> : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-lg border border-dashed border-stone-300 bg-white p-4 text-sm text-stone-500">No active devices found yet.</p>
                )}
              </div>
            </section>
          ) : null}
          {activeSection === "database" ? (
            <section className="rounded-lg border border-stone-200 bg-stone-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-black">Database</h3>
                <span className={`rounded-full border px-2 py-1 text-xs font-black uppercase tracking-normal ${databaseStatus?.persistent ? "border-teal-300 bg-teal-100 text-teal-900" : "border-red-300 bg-red-100 text-red-900"}`}>
                  {databaseStatus?.persistent ? "Database connected" : "Database offline"}
                </span>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <InfoTile label="Current database" value={databaseStatus?.provider ?? "Checking"} />
                <InfoTile label="Database name" value={databaseStatus?.databaseName ?? "Checking"} />
                <InfoTile label="Persistent storage" value={databaseStatus ? (databaseStatus.persistent ? "Yes" : "No") : "Checking"} />
              </div>
              <div className="mt-4 rounded-lg border border-stone-200 bg-white p-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={17} className="text-teal-800" />
                  <p className="font-black">Quote data protection</p>
                </div>
                <p className="mt-2 text-sm text-stone-600">
                  MongoDB uses TLS in transit and provider-side encryption at rest. For production-grade breach protection, the next step is app-level field encryption for customer, project, pricing, and notes before writing quote records.
                </p>
              </div>
            </section>
          ) : null}
          {activeSection === "serviceTitan" ? (
            <section className="grid gap-3 rounded-lg border border-stone-200 bg-stone-50 p-4 md:grid-cols-2">
              <h3 className="font-black md:col-span-2">ServiceTitan Admin Panel</h3>
              <label className="field md:col-span-2">
                <span>Base URL</span>
                <input className="input" value={settings.baseUrl} onChange={(event) => setSettings((current) => ({ ...current, baseUrl: event.target.value }))} />
              </label>
              <label className="field">
                <span>Tenant ID</span>
                <input className="input" value={settings.tenantId} onChange={(event) => setSettings((current) => ({ ...current, tenantId: event.target.value }))} />
              </label>
              <label className="field">
                <span>Client ID</span>
                <input className="input" value={settings.clientId} onChange={(event) => setSettings((current) => ({ ...current, clientId: event.target.value }))} />
              </label>
              <label className="field md:col-span-2">
                <span>Client Secret</span>
                <input className="input" type="password" value={settings.clientSecret} onChange={(event) => setSettings((current) => ({ ...current, clientSecret: event.target.value }))} />
              </label>
            </section>
          ) : null}
          {activeSection === "adi" ? (
            <section className="grid gap-3 rounded-lg border border-stone-200 bg-stone-50 p-4 md:grid-cols-2">
              <h3 className="font-black md:col-span-2">ADI MSRP Admin Panel</h3>
              <label className="field md:col-span-2">
                <span>ADI Base URL</span>
                <input className="input" value={settings.adiBaseUrl ?? ""} onChange={(event) => setSettings((current) => ({ ...current, adiBaseUrl: event.target.value }))} placeholder="Future ADI API or feed URL" />
              </label>
              <label className="field">
                <span>ADI Account Number</span>
                <input className="input" value={settings.adiAccountNumber ?? ""} onChange={(event) => setSettings((current) => ({ ...current, adiAccountNumber: event.target.value }))} />
              </label>
              <label className="field">
                <span>ADI API Key</span>
                <input className="input" type="password" value={settings.adiApiKey ?? ""} onChange={(event) => setSettings((current) => ({ ...current, adiApiKey: event.target.value }))} />
              </label>
            </section>
          ) : null}
          {activeSection === "sync" ? (
            <section className="rounded-lg border border-stone-200 bg-stone-50 p-4">
              <h3 className="font-black">Sync Panel</h3>
              <p className="mt-2 text-sm text-stone-600">Sync can later pull ServiceTitan items and ADI MSRP data into the database.</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button className="button-primary" onClick={() => setSyncConfirmOpen(true)}>
                  Sync Now
                </button>
                <span className="text-sm text-stone-600">Last sync: {settings.lastSyncAt ? new Date(settings.lastSyncAt).toLocaleString() : "Never"}</span>
              </div>
            </section>
          ) : null}
          {activeSection === "recovery" ? (
            <section className="grid gap-4 rounded-lg border border-stone-200 bg-stone-50 p-4">
              <div>
                <h3 className="font-black">Admin Recovery</h3>
                <p className="mt-1 text-sm text-stone-600">Deleted records self-purge after 30 days. Permanent delete cannot be recovered.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
                <input className="input" value={recoverySearch} onChange={(event) => setRecoverySearch(event.target.value)} placeholder="Search deleted quotes or items" />
                <select className="input" value={recoverySort} onChange={(event) => setRecoverySort(event.target.value as RecoverySort)}>
                  <option value="recent">Most recent</option>
                  <option value="name">Name</option>
                </select>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                <h3 className="font-black">Deleted Quotes</h3>
                <div className="mt-3 grid gap-2">
                  {deletedQuotes.length ? (
                    deletedQuotes.map((quote) => {
                      const daysRemaining = daysUntilRecoveryPurge(quote.deletedAt);
                      return (
                      <div key={quote.id} className={`relative rounded-lg border p-3 ${recoveryUrgencyClasses(daysRemaining)}`}>
                        <span className="absolute right-3 top-3 rounded-full bg-white/80 px-2 py-1 text-xs font-black">{daysRemaining}d left</span>
                        <p className="pr-20 font-bold">{quote.meta.customer || "Unnamed customer"}</p>
                        <p className="text-sm font-semibold">{quote.meta.project || quote.meta.quoteNumber}</p>
                        {quote.meta.location ? <p className="text-xs text-stone-600">{quote.meta.location}</p> : null}
                        <p className="text-xs text-stone-600">Deleted {quote.deletedAt ? new Date(quote.deletedAt).toLocaleString() : "recently"}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button className="button-secondary min-h-9" onClick={() => recoverQuote(quote.id)}>
                            Recover
                          </button>
                          <button className="button-ghost min-h-9 text-red-800 hover:bg-red-50" onClick={() => setPermanentDeleteTarget({ kind: "quote", id: quote.id, label: quote.meta.customer || quote.meta.quoteNumber })}>
                            <Trash2 size={16} />
                            Delete
                          </button>
                        </div>
                      </div>
                      );
                    })
                  ) : (
                    <p className="rounded-lg border border-dashed border-stone-300 bg-white p-4 text-sm text-stone-500">No deleted quotes.</p>
                  )}
                </div>
              </div>
              <div>
                <h3 className="font-black">Deleted Items</h3>
                <div className="mt-3 grid gap-2">
                  {deletedItems.length ? (
                    deletedItems.map((item) => {
                      const daysRemaining = daysUntilRecoveryPurge(item.deletedAt);
                      return (
                      <div key={item.id} className={`relative rounded-lg border p-3 ${recoveryUrgencyClasses(daysRemaining)}`}>
                        <span className="absolute right-3 top-3 rounded-full bg-white/80 px-2 py-1 text-xs font-black">{daysRemaining}d left</span>
                        <p className="pr-20 font-bold">{item.name}</p>
                        <p className="font-mono text-xs text-stone-600">{item.sku}</p>
                        <p className="text-xs text-stone-600">Deleted {item.deletedAt ? new Date(item.deletedAt).toLocaleString() : "recently"}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button className="button-secondary min-h-9" onClick={() => recoverItem(item.id)}>
                            Recover
                          </button>
                          <button className="button-ghost min-h-9 text-red-800 hover:bg-red-50" onClick={() => setPermanentDeleteTarget({ kind: "item", id: item.id, label: item.name })}>
                            <Trash2 size={16} />
                            Delete
                          </button>
                        </div>
                      </div>
                      );
                    })
                  ) : (
                    <p className="rounded-lg border border-dashed border-stone-300 bg-white p-4 text-sm text-stone-500">No deleted items.</p>
                  )}
                </div>
              </div>
              </div>
            </section>
          ) : null}
        </div>
      </div>
      {syncConfirmOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4" onClick={() => setSyncConfirmOpen(false)}>
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-2xl font-black">Sync now?</h3>
                <p className="mt-2 text-sm text-stone-600">This will update the saved last sync time and is ready for future ServiceTitan and ADI data pulls.</p>
              </div>
              <button className="icon-button" onClick={() => setSyncConfirmOpen(false)} aria-label="Cancel sync">
                <X size={18} />
              </button>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="button-ghost" onClick={() => setSyncConfirmOpen(false)}>
                Cancel
              </button>
              <button className="button-primary" onClick={confirmSync}>
                Sync Now
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {permanentDeleteTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4" onClick={() => setPermanentDeleteTarget(null)}>
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-2xl font-black text-red-900">Permanently delete?</h3>
                <p className="mt-2 text-sm text-stone-600">This permanently deletes {permanentDeleteTarget.label}. It cannot be recovered after this action.</p>
              </div>
              <button className="icon-button" onClick={() => setPermanentDeleteTarget(null)} aria-label="Cancel permanent delete">
                <X size={18} />
              </button>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="button-ghost" onClick={() => setPermanentDeleteTarget(null)}>
                Cancel
              </button>
              <button className="button-primary bg-red-700 hover:bg-red-800" onClick={confirmPermanentDelete}>
                <Trash2 size={16} />
                Delete forever
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-3">
      <p className="text-xs font-bold uppercase tracking-normal text-stone-500">{label}</p>
      <p className="mt-2 font-black text-stone-950">{value}</p>
    </div>
  );
}

function MobileMenu({
  nav,
  view,
  setView,
  goToQuote,
  close,
  onSignOut,
  onSettingsHoldStart,
  onSettingsHoldEnd,
}: {
  nav: { id: View; label: string; icon: LucideIcon }[];
  view: View;
  setView: (view: View) => void;
  goToQuote: () => void;
  close: () => void;
  onSignOut: () => void;
  onSettingsHoldStart: () => void;
  onSettingsHoldEnd: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/35 md:hidden" onClick={close}>
      <div className="h-full w-80 max-w-[85vw] bg-white p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between">
          <button
            className="flex items-center gap-3 text-left"
            onClick={() => {
              goToQuote();
              close();
            }}
          >
            <span className="grid size-9 place-items-center rounded-lg bg-stone-900 text-lg font-black text-white">Q</span>
            <span className="font-black">Quick Quote Builder</span>
          </button>
          <button className="icon-button" onClick={close} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>
        <div className="mt-5 grid gap-2">
          {nav.map((item) => (
            <button
              key={item.id}
              className={`nav-button justify-start ${view === item.id ? "nav-button-active" : ""}`}
              onPointerDown={item.id === "settings" ? onSettingsHoldStart : undefined}
              onPointerUp={item.id === "settings" ? onSettingsHoldEnd : undefined}
              onPointerLeave={item.id === "settings" ? onSettingsHoldEnd : undefined}
              onClick={() => {
                setView(item.id);
                close();
              }}
            >
              <item.icon size={17} />
              {item.label}
            </button>
          ))}
          <button
            className="nav-button justify-start text-red-800"
            onClick={() => {
              close();
              onSignOut();
            }}
          >
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
