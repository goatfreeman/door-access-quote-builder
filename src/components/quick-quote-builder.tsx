"use client";

import {
  Bell,
  ChevronDown,
  ClipboardList,
  Database,
  FileText,
  Mail,
  Menu,
  PackagePlus,
  Printer,
  Save,
  Settings,
  ShoppingCart,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { readDb, writeDb } from "@/lib/client-db";
import type { CatalogItem, QuoteLine, QuoteMeta, QuoteTemplate, SavedQuote, ServiceTitanSettings } from "@/lib/types";

type View = "quote" | "items" | "templates" | "previous" | "settings";
type QuoteStep = "pick" | "customize" | "review" | "finalize";
type SettingsSection = "account" | "database" | "serviceTitan" | "adi" | "sync";
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

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const appStage = process.env.NEXT_PUBLIC_APP_STAGE ?? "development";
const isProductionStage = appStage.toLowerCase() === "production";
const STORAGE_KEYS = {
  items: "qqb.cache.items.v1",
  templates: "qqb.cache.templates.v1",
  quotes: "qqb.cache.quotes.v1",
  settings: "qqb.cache.settings.v1",
};

const emptyMeta: QuoteMeta = {
  customer: "",
  project: "",
  email: "",
  quoteNumber: "QQ-1001",
  marginPercent: 18,
  taxPercent: 8.875,
  includeLabor: true,
};

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

export function QuickQuoteBuilder() {
  const [view, setView] = useState<View>("quote");
  const [quoteStep, setQuoteStep] = useState<QuoteStep>("pick");
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [templates, setTemplates] = useState<QuoteTemplate[]>([]);
  const [quotes, setQuotes] = useState<SavedQuote[]>([]);
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
  const [hydrated, setHydrated] = useState(false);
  const cartRef = useRef<HTMLDetailsElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      readDb<CatalogItem[]>("items", readStorage(STORAGE_KEYS.items, [])),
      readDb<QuoteTemplate[]>("templates", readStorage(STORAGE_KEYS.templates, [])),
      readDb<SavedQuote[]>("quotes", readStorage(STORAGE_KEYS.quotes, [])),
      readDb<ServiceTitanSettings>("settings", readStorage(STORAGE_KEYS.settings, { baseUrl: "", tenantId: "", clientId: "", clientSecret: "" })),
    ]).then(([dbItems, dbTemplates, dbQuotes, dbSettings]) => {
      if (cancelled) return;
      setItems(dbItems);
      setTemplates(dbTemplates);
      setQuotes(dbQuotes);
      setSettings(dbSettings);
      setHydrated(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (hydrated) {
      writeStorage(STORAGE_KEYS.items, items);
      void writeDb("items", items);
    }
  }, [hydrated, items]);

  useEffect(() => {
    if (hydrated) {
      writeStorage(STORAGE_KEYS.templates, templates);
      void writeDb("templates", templates);
    }
  }, [hydrated, templates]);

  useEffect(() => {
    if (hydrated) {
      writeStorage(STORAGE_KEYS.quotes, quotes);
      void writeDb("quotes", quotes);
    }
  }, [hydrated, quotes]);

  useEffect(() => {
    if (hydrated) {
      writeStorage(STORAGE_KEYS.settings, settings);
      void writeDb("settings", settings);
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
    return items.filter((item) => {
      const matchesCategory = category === "All" || item.category === category;
      const matchesSearch = !query || [item.name, item.sku, item.vendor, item.notes].some((value) => value?.toLowerCase().includes(query));
      return matchesCategory && matchesSearch;
    });
  }, [items, search, category]);
  const catalogCategories = useMemo(() => ["All", ...Array.from(new Set(items.map((item) => item.category).filter(Boolean))).sort((a, b) => a.localeCompare(b))], [items]);

  useEffect(() => {
    if (category !== "All" && !catalogCategories.includes(category)) {
      setCategory("All");
    }
  }, [catalogCategories, category]);

  const activeLines = useMemo(() => lines.filter((line) => meta.includeLabor || !isLabor(line)), [lines, meta.includeLabor]);
  const totals = useMemo(() => {
    const subtotal = activeLines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
    const marginAmount = subtotal * (meta.marginPercent / 100);
    const taxable = subtotal + marginAmount;
    const taxAmount = taxable * (meta.taxPercent / 100);
    return { subtotal, marginAmount, taxAmount, total: taxable + taxAmount };
  }, [activeLines, meta.marginPercent, meta.taxPercent]);
  const cartCount = activeLines.reduce((sum, line) => sum + line.quantity, 0);

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
          notes: item.notes ?? "",
        },
      ];
    });
  };

  const addTemplate = (template: QuoteTemplate) => {
    template.lines.forEach((line) => {
      const item = items.find((candidate) => candidate.id === line.itemId);
      if (item) addItem(item, template.name, line.quantity);
    });
    setQuoteStep("customize");
  };

  const updateLine = (lineId: string, patch: Partial<QuoteLine>) => {
    setLines((current) => current.map((line) => (line.lineId === lineId ? { ...line, ...patch } : line)));
  };

  const deleteItemEverywhere = (itemId: string) => {
    setItems((current) => current.filter((item) => item.id !== itemId));
    setTemplates((current) =>
      current.map((template) => ({
        ...template,
        lines: template.lines.filter((line) => line.itemId !== itemId),
      })),
    );
    setLines((current) => current.filter((line) => line.itemId !== itemId));
  };

  const saveQuote = () => {
    const now = new Date().toISOString();
    const saved: SavedQuote = {
      id: makeId("quote"),
      createdAt: now,
      updatedAt: now,
      meta,
      lines,
      total: totals.total,
    };
    setQuotes((current) => [saved, ...current]);
    setSelectedQuote(saved);
    setView("previous");
  };

  const loadQuoteForEdit = (quote: SavedQuote) => {
    setMeta(quote.meta);
    setLines(quote.lines);
    setSelectedQuote(null);
    setView("quote");
    setQuoteStep("customize");
  };

  const printQuote = () => window.print();

  const sendEmail = () => {
    setMeta((current) => ({ ...current, email: pendingEmail }));
    setEmailPromptOpen(false);
    window.setTimeout(() => window.print(), 80);
  };

  const syncServiceTitan = () => {
    setSettings((current) => ({ ...current, lastSyncAt: new Date().toISOString() }));
  };

  const nav = [
    { id: "quote" as const, label: "Quote", icon: ClipboardList },
    { id: "items" as const, label: "Items", icon: PackagePlus },
    { id: "templates" as const, label: "Templates", icon: FileText },
    { id: "previous" as const, label: "Previous Quotes", icon: Database },
    { id: "settings" as const, label: "Settings", icon: Settings },
  ];

  const goToQuote = () => {
    setView("quote");
    setMenuOpen(false);
    setCartOpen(false);
    setNotificationOpen(false);
  };

  return (
    <main className="min-h-screen bg-stone-100 text-stone-950">
      <header className="sticky top-0 z-40 border-b border-stone-200 bg-stone-100/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <button className="icon-button md:hidden" onClick={() => setMenuOpen(true)} aria-label="Open menu">
              <Menu size={19} />
            </button>
            <button className="grid size-10 place-items-center rounded-lg bg-stone-900 text-xl font-black text-white" onClick={goToQuote} aria-label="Go to quote page">
              Q
            </button>
            <button className="min-w-0 text-left" onClick={goToQuote} aria-label="Go to quote page">
              <span className="flex min-w-0 flex-wrap items-center gap-2">
                <h1 className="truncate text-lg font-black leading-tight sm:text-2xl">Quick Quote Builder</h1>
                {!isProductionStage ? <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-1 text-xs font-black uppercase tracking-normal text-amber-900">Dev Build</span> : null}
              </span>
              <p className="hidden text-sm text-stone-600 sm:block">Quote equipment, labor, templates, and saved jobs.</p>
            </button>
          </div>
          <nav className="hidden items-center gap-2 md:flex">
            {nav.map((item) => (
              <button key={item.id} className={`nav-button ${view === item.id ? "nav-button-active" : ""}`} onClick={() => setView(item.id)}>
                <item.icon size={16} />
                {item.label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
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
                onNext={() => {
                  setQuoteStep("finalize");
                  setCartOpen(false);
                }}
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
                <span className="absolute right-2 top-2 size-2 rounded-full bg-red-700" />
              </button>
              {notificationOpen ? (
                <div className="absolute right-0 top-12 z-50 w-80 rounded-lg border border-stone-200 bg-white p-4 shadow-xl">
                  <p className="font-bold">Notifications</p>
                  <p className="mt-2 text-sm text-stone-600">Database connection and ServiceTitan sync are in local placeholder mode until production credentials are connected.</p>
                </div>
              ) : null}
            </div>
            <button className="icon-button" onClick={() => setView("settings")} aria-label="Settings">
              <Settings size={18} />
            </button>
          </div>
        </div>
      </header>

      {menuOpen ? <MobileMenu nav={nav} view={view} setView={setView} goToQuote={goToQuote} close={() => setMenuOpen(false)} /> : null}

      <section className={`mx-auto grid max-w-7xl gap-4 px-4 py-4 ${view === "quote" && quoteStep !== "finalize" ? "lg:grid-cols-[320px_minmax(0,1fr)]" : ""}`}>
        {view === "quote" ? (
          <>
            {quoteStep !== "finalize" ? (
              <CatalogPanel items={visibleItems} categories={catalogCategories} category={category} search={search} setSearch={setSearch} setCategory={setCategory} onAdd={addItem} />
            ) : null}
            <QuoteWorkspace
              step={quoteStep}
              setStep={setQuoteStep}
              lines={activeLines}
              allLines={lines}
              meta={meta}
              setMeta={setMeta}
              totals={totals}
              templates={templates}
              onAddTemplate={addTemplate}
              onUpdateLine={updateLine}
              onRemoveLine={(id) => setLines((current) => current.filter((line) => line.lineId !== id))}
              onSave={saveQuote}
              onPrint={printQuote}
              onEmail={() => {
                setPendingEmail(meta.email);
                setEmailPromptOpen(true);
              }}
            />
          </>
        ) : null}

        {view === "items" ? <ItemsPage items={items} setItems={setItems} onDeleteItem={deleteItemEverywhere} /> : null}
        {view === "templates" ? <TemplatesPage templates={templates} items={items} setTemplates={setTemplates} onAddTemplate={addTemplate} /> : null}
        {view === "previous" ? <PreviousQuotes quotes={quotes} selectedQuote={selectedQuote} setSelectedQuote={setSelectedQuote} onEdit={loadQuoteForEdit} setQuotes={setQuotes} /> : null}
        {view === "settings" ? <SettingsPage settings={settings} setSettings={setSettings} onSync={syncServiceTitan} /> : null}
      </section>

      {view === "quote" ? (
        <BottomTotalBar total={totals.total} label={quoteStep === "finalize" ? "Print" : "Next"} onClick={() => (quoteStep === "finalize" ? printQuote() : setQuoteStep(nextStep(quoteStep)))} />
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
    </main>
  );
}

function nextStep(step: QuoteStep): QuoteStep {
  if (step === "pick") return "customize";
  if (step === "customize") return "review";
  if (step === "review") return "finalize";
  return "finalize";
}

function CartDropdown({
  lines,
  totals,
  onNext,
}: {
  lines: QuoteLine[];
  totals: { subtotal: number; marginAmount: number; taxAmount: number; total: number };
  onNext: () => void;
}) {
  return (
    <div className="absolute right-0 top-12 z-50 grid max-h-[calc(100vh-7rem)] w-[min(390px,calc(100vw-1.5rem))] gap-3 overflow-auto rounded-lg border border-stone-200 bg-white p-4 shadow-2xl">
      <div className="flex items-center justify-between">
        <p className="font-black">Shopping cart</p>
        <p className="text-sm text-stone-500">{lines.length} lines</p>
      </div>
      <div className="grid gap-2">
        {lines.length ? (
          lines.map((line) => (
            <div key={line.lineId} className="rounded-lg border border-stone-200 bg-stone-50 p-3">
              <p className="font-bold">{line.packageName ?? line.name}</p>
              {line.packageName ? <p className="mt-1 text-sm text-stone-600">{line.name}</p> : null}
              <p className="mt-1 text-sm text-stone-600">Qty {line.quantity}</p>
            </div>
          ))
        ) : (
          <p className="rounded-lg border border-dashed border-stone-300 p-4 text-center text-sm text-stone-500">No items added yet.</p>
        )}
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
  allLines: QuoteLine[];
  meta: QuoteMeta;
  setMeta: Dispatch<SetStateAction<QuoteMeta>>;
  totals: { subtotal: number; marginAmount: number; taxAmount: number; total: number };
  templates: QuoteTemplate[];
  onAddTemplate: (template: QuoteTemplate) => void;
  onUpdateLine: (lineId: string, patch: Partial<QuoteLine>) => void;
  onRemoveLine: (lineId: string) => void;
  onSave: () => void;
  onPrint: () => void;
  onEmail: () => void;
}) {
  const steps: QuoteStep[] = ["pick", "customize", "review", "finalize"];
  return (
    <section className="grid gap-4">
      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>Quote Workspace</h2>
            <p>{props.step === "pick" ? "Choose a template or add catalog items." : "Review cart details and finalize the quote."}</p>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            {steps.map((step) => (
              <button key={step} className={`chip capitalize ${props.step === step ? "chip-active" : ""}`} onClick={() => props.setStep(step)}>
                {step}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 p-4">
          <div className="grid grid-cols-[auto_1fr_auto_1fr_auto_1fr_auto] items-center gap-2 sm:hidden">
            {steps.map((step, index) => (
              <div key={step} className="contents">
                <button className={`grid size-8 place-items-center rounded-full text-sm font-black ${props.step === step ? "bg-teal-700 text-white" : "bg-white text-stone-600"}`} onClick={() => props.setStep(step)}>
                  {index + 1}
                </button>
                {index < steps.length - 1 ? <span className="h-px bg-stone-300" /> : null}
              </div>
            ))}
          </div>

          {props.step === "pick" ? (
            <div className="grid gap-3 md:grid-cols-3">
              {props.templates.map((template) => (
                <button key={template.id} className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-left transition hover:border-teal-700 hover:bg-teal-50" onClick={() => props.onAddTemplate(template)}>
                  <p className="font-black">{template.name}</p>
                  <p className="mt-2 text-sm text-stone-600">{template.description}</p>
                  <p className="mt-4 text-sm font-bold text-teal-800">{template.lines.length} preset lines</p>
                </button>
              ))}
            </div>
          ) : null}

          {props.step === "customize" || props.step === "review" || props.step === "finalize" ? (
            <QuoteLines lines={props.lines} onUpdateLine={props.onUpdateLine} onRemoveLine={props.onRemoveLine} />
          ) : null}

          {props.step === "finalize" ? (
            <FinalizePanel meta={props.meta} setMeta={props.setMeta} totals={props.totals} onSave={props.onSave} onPrint={props.onPrint} onEmail={props.onEmail} />
          ) : null}
        </div>
      </div>
    </section>
  );
}

function QuoteLines({ lines, onUpdateLine, onRemoveLine }: { lines: QuoteLine[]; onUpdateLine: (lineId: string, patch: Partial<QuoteLine>) => void; onRemoveLine: (lineId: string) => void }) {
  if (!lines.length) {
    return <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-8 text-center text-stone-500">Add catalog items or choose a template to start.</div>;
  }
  return (
    <div className="grid gap-3">
      {lines.map((line) => (
        <details key={line.lineId} className="overflow-hidden rounded-lg border border-stone-200 bg-stone-50">
          <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
            <div className="min-w-0">
              {line.packageName ? <span className="mb-1 inline-flex rounded-full bg-teal-100 px-2 py-1 text-xs font-black text-teal-900">{line.packageName}</span> : null}
              <p className="truncate font-black">{line.name}</p>
            </div>
            <span className="font-black">Qty {line.quantity}</span>
            <ChevronDown size={17} className="text-stone-500" />
          </summary>
          <div className="grid gap-3 border-t border-stone-200 p-4 md:grid-cols-2">
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
              <textarea className="textarea" value={line.notes} onChange={(event) => onUpdateLine(line.lineId, { notes: event.target.value })} />
            </label>
            <div className="flex items-center justify-between gap-3 md:col-span-2">
              <strong>{money.format(line.quantity * line.unitPrice)}</strong>
              <button className="button-ghost" onClick={() => onRemoveLine(line.lineId)}>
                <Trash2 size={16} />
                Remove
              </button>
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}

function FinalizePanel({
  meta,
  setMeta,
  totals,
  onSave,
  onPrint,
  onEmail,
}: {
  meta: QuoteMeta;
  setMeta: Dispatch<SetStateAction<QuoteMeta>>;
  totals: { subtotal: number; marginAmount: number; taxAmount: number; total: number };
  onSave: () => void;
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
      </div>
      <div className="grid gap-3">
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

function TotalsCard({ totals }: { totals: { subtotal: number; marginAmount: number; taxAmount: number; total: number } }) {
  return (
    <div className="grid gap-2 rounded-lg border border-stone-200 bg-white p-4">
      <SummaryRow label="Equipment and labor" value={totals.subtotal} />
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

function ItemsPage({
  items,
  setItems,
  onDeleteItem,
}: {
  items: CatalogItem[];
  setItems: Dispatch<SetStateAction<CatalogItem[]>>;
  onDeleteItem: (itemId: string) => void;
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
    onDeleteItem(id);
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
                <p className="font-mono text-xs text-stone-500">{item.sku} / {item.category}</p>
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
              <div className="flex justify-end md:col-span-3">
                <button className="button-ghost text-red-800 hover:bg-red-100" onClick={() => setDeleteItem(item)}>
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
          <div className="w-full max-w-3xl rounded-lg bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
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
  setTemplates,
  onAddTemplate,
}: {
  templates: QuoteTemplate[];
  items: CatalogItem[];
  setTemplates: Dispatch<SetStateAction<QuoteTemplate[]>>;
  onAddTemplate: (template: QuoteTemplate) => void;
}) {
  const [deleteTemplate, setDeleteTemplate] = useState<QuoteTemplate | null>(null);
  const confirmDeleteTemplate = () => {
    if (!deleteTemplate) return;
    setTemplates((current) => current.filter((template) => template.id !== deleteTemplate.id));
    setDeleteTemplate(null);
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
            setTemplates((current) => [
              ...current,
              {
                id: makeId("template"),
                name: "New Template",
                description: "",
                lines: [],
              },
            ])
          }
        >
          <PackagePlus size={17} />
          Add Template
        </button>
      </div>
      <div className="grid gap-3 p-4 md:grid-cols-3">
        {templates.length ? (
          templates.map((template) => (
            <TemplateCard key={template.id} template={template} items={items} setTemplates={setTemplates} onAddTemplate={onAddTemplate} onDeleteTemplate={setDeleteTemplate} />
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
    </section>
  );
}

function TemplateCard({
  template,
  items,
  setTemplates,
  onAddTemplate,
  onDeleteTemplate,
}: {
  template: QuoteTemplate;
  items: CatalogItem[];
  setTemplates: Dispatch<SetStateAction<QuoteTemplate[]>>;
  onAddTemplate: (template: QuoteTemplate) => void;
  onDeleteTemplate: (template: QuoteTemplate) => void;
}) {
  const [selectedItemId, setSelectedItemId] = useState(items[0]?.id ?? "");
  useEffect(() => {
    if (!items.length) {
      setSelectedItemId("");
      return;
    }
    if (!selectedItemId || !items.some((item) => item.id === selectedItemId)) {
      setSelectedItemId(items[0].id);
    }
  }, [items, selectedItemId]);
  const updateTemplate = (patch: Partial<QuoteTemplate>) => {
    setTemplates((current) => current.map((candidate) => (candidate.id === template.id ? { ...candidate, ...patch } : candidate)));
  };
  const addTemplateLine = () => {
    if (!selectedItemId) return;
    updateTemplate({
      lines: template.lines.some((line) => line.itemId === selectedItemId)
        ? template.lines.map((line) => (line.itemId === selectedItemId ? { ...line, quantity: line.quantity + 1 } : line))
        : [...template.lines, { itemId: selectedItemId, quantity: 1 }],
    });
  };

  return (
    <article className="rounded-lg border border-stone-200 bg-stone-50 p-4">
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
      <textarea className="textarea mt-3" value={template.description} onChange={(event) => updateTemplate({ description: event.target.value })} placeholder="Template description" />
      <div className="mt-3 grid gap-2">
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
      <label className="field mt-3">
        <span>Item to add</span>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <select className="input bg-white font-bold" value={selectedItemId} onChange={(event) => setSelectedItemId(event.target.value)} disabled={!items.length}>
            {items.length ? (
              items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))
            ) : (
              <option value="">None</option>
            )}
          </select>
          <button className="button-secondary" onClick={addTemplateLine} disabled={!selectedItemId}>
            Add
          </button>
        </div>
      </label>
      <button className="button-primary mt-4 w-full" onClick={() => onAddTemplate(template)}>
        Add to Quote
      </button>
    </article>
  );
}

function PreviousQuotes({
  quotes,
  selectedQuote,
  setSelectedQuote,
  onEdit,
  setQuotes,
}: {
  quotes: SavedQuote[];
  selectedQuote: SavedQuote | null;
  setSelectedQuote: (quote: SavedQuote | null) => void;
  onEdit: (quote: SavedQuote) => void;
  setQuotes: Dispatch<SetStateAction<SavedQuote[]>>;
}) {
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
          {quotes.length ? (
            quotes.map((quote) => (
              <button key={quote.id} className={`rounded-lg border p-3 text-left ${selectedQuote?.id === quote.id ? "border-teal-700 bg-teal-50" : "border-stone-200 bg-white"}`} onClick={() => setSelectedQuote(quote)}>
                <p className="font-black">{quote.meta.customer || "Unnamed customer"}</p>
                <p className="text-sm text-stone-600">{new Date(quote.createdAt).toLocaleDateString()} · {quote.meta.project || quote.meta.quoteNumber}</p>
                <p className="mt-2 font-black">{money.format(quote.total)}</p>
              </button>
            ))
          ) : (
            <p className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-stone-500">No saved quotes yet.</p>
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
                <p className="text-sm text-stone-600">Quoted {new Date(selectedQuote.createdAt).toLocaleString()}</p>
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
              <div className="flex flex-wrap gap-2">
                <button className="button-primary" onClick={() => onEdit(selectedQuote)}>
                  Edit Quote
                </button>
                <button className="button-ghost" onClick={() => setQuotes((current) => current.filter((quote) => quote.id !== selectedQuote.id))}>
                  <Trash2 size={16} />
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-stone-300 p-10 text-center text-stone-500">Select a previous quote to view the cart summary.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function SettingsPage({ settings, setSettings, onSync }: { settings: ServiceTitanSettings; setSettings: Dispatch<SetStateAction<ServiceTitanSettings>>; onSync: () => void }) {
  const [activeSection, setActiveSection] = useState<SettingsSection>("account");
  const [databaseStatus, setDatabaseStatus] = useState<DatabaseStatus | null>(null);
  const [syncConfirmOpen, setSyncConfirmOpen] = useState(false);
  const sections: { id: SettingsSection; label: string }[] = [
    { id: "account", label: "Account Info" },
    { id: "database", label: "Database" },
    { id: "serviceTitan", label: "ServiceTitan" },
    { id: "adi", label: "ADI MSRP" },
    { id: "sync", label: "Sync" },
  ];

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

  const confirmSync = () => {
    onSync();
    setSyncConfirmOpen(false);
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
          {sections.map((item) => (
            <button key={item.id} className={`rounded-md px-3 py-2 text-left font-bold transition ${activeSection === item.id ? "bg-white text-teal-800 shadow-sm" : "hover:bg-white"}`} onClick={() => setActiveSection(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
        <div className="grid gap-4">
          {activeSection === "account" ? (
            <section className="rounded-lg border border-stone-200 bg-stone-50 p-4">
              <h3 className="font-black">Account Info</h3>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="field">
                  <span>User</span>
                  <input className="input" value="User" readOnly />
                </label>
                <label className="field">
                  <span>Login provider</span>
                  <input className="input" value="Microsoft Azure SSO placeholder" readOnly />
                </label>
              </div>
            </section>
          ) : null}
          {activeSection === "database" ? (
            <section className="rounded-lg border border-stone-200 bg-stone-50 p-4">
              <h3 className="font-black">Database</h3>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <InfoTile label="Current database" value={databaseStatus?.provider ?? "Checking"} />
                <InfoTile label="Database name" value={databaseStatus?.databaseName ?? "Checking"} />
                <InfoTile label="Persistent storage" value={databaseStatus ? (databaseStatus.persistent ? "Yes" : "No") : "Checking"} />
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
}: {
  nav: { id: View; label: string; icon: LucideIcon }[];
  view: View;
  setView: (view: View) => void;
  goToQuote: () => void;
  close: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/35 md:hidden" onClick={close}>
      <div className="h-full w-80 max-w-[85vw] bg-white p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between">
          <button className="flex items-center gap-3 text-left" onClick={goToQuote}>
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
              onClick={() => {
                setView(item.id);
                close();
              }}
            >
              <item.icon size={17} />
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function BottomTotalBar({ total, label, onClick }: { total: number; label: string; onClick: () => void }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white p-3 shadow-2xl md:hidden">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-stone-500">Total</p>
          <p className="text-xl font-black">{money.format(total)}</p>
        </div>
        <button className="button-primary min-w-32" onClick={onClick}>
          {label}
        </button>
      </div>
    </div>
  );
}
