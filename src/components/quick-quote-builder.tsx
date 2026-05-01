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
import { loadCatalogItemsFromCsv } from "@/lib/item-csv";
import { seedTemplates } from "@/lib/seed-data";
import type { CatalogItem, QuoteLine, QuoteMeta, QuoteTemplate, SavedQuote, ServiceTitanSettings } from "@/lib/types";

type View = "quote" | "items" | "templates" | "previous" | "settings";
type QuoteStep = "pick" | "customize" | "review" | "finalize";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const STORAGE_KEYS = {
  items: "qqb.items.csv.v1",
  templates: "qqb.templates.v2",
  quotes: "qqb.quotes.v2",
  settings: "qqb.settings.v2",
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

export function QuickQuoteBuilder() {
  const [view, setView] = useState<View>("quote");
  const [quoteStep, setQuoteStep] = useState<QuoteStep>("pick");
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [templates, setTemplates] = useState<QuoteTemplate[]>(seedTemplates);
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
    const storedItems = readStorage<CatalogItem[]>(STORAGE_KEYS.items, []);
    if (storedItems.length) {
      setItems(storedItems);
    } else {
      loadCatalogItemsFromCsv()
        .then((csvItems) => {
          if (!cancelled) setItems(csvItems);
        })
        .catch(() => {
          if (!cancelled) setItems([]);
        });
    }
    setTemplates(readStorage(STORAGE_KEYS.templates, seedTemplates));
    setQuotes(readStorage(STORAGE_KEYS.quotes, []));
    setSettings(readStorage(STORAGE_KEYS.settings, { baseUrl: "", tenantId: "", clientId: "", clientSecret: "" }));
    setHydrated(true);

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (hydrated) writeStorage(STORAGE_KEYS.items, items);
  }, [hydrated, items]);

  useEffect(() => {
    if (hydrated) writeStorage(STORAGE_KEYS.templates, templates);
  }, [hydrated, templates]);

  useEffect(() => {
    if (hydrated) writeStorage(STORAGE_KEYS.quotes, quotes);
  }, [hydrated, quotes]);

  useEffect(() => {
    if (hydrated) writeStorage(STORAGE_KEYS.settings, settings);
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
              <h1 className="truncate text-lg font-black leading-tight sm:text-2xl">Quick Quote Builder</h1>
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

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        {view === "quote" ? (
          <>
            <CatalogPanel items={visibleItems} category={category} search={search} setSearch={setSearch} setCategory={setCategory} onAdd={addItem} />
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

        {view === "items" ? <ItemsPage items={items} setItems={setItems} /> : null}
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
        Next
      </button>
    </div>
  );
}

function CatalogPanel({
  items,
  category,
  search,
  setSearch,
  setCategory,
  onAdd,
}: {
  items: CatalogItem[];
  category: string;
  search: string;
  setSearch: (value: string) => void;
  setCategory: (value: string) => void;
  onAdd: (item: CatalogItem) => void;
}) {
  const categories = ["All", "Camera", "Access Control", "Door Hardware", "Labor", "Network", "Other"];
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
        <input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search items or SKU" />
        <div className="grid grid-cols-2 gap-2">
          {categories.map((item) => (
            <button key={item} className={`chip ${category === item ? "chip-active" : ""}`} onClick={() => setCategory(item)}>
              {item}
            </button>
          ))}
        </div>
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

function ItemsPage({ items, setItems }: { items: CatalogItem[]; setItems: Dispatch<SetStateAction<CatalogItem[]>> }) {
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sortMode, setSortMode] = useState<"category" | "name" | "price">("category");
  const categories = useMemo(() => ["All", ...Array.from(new Set(items.map((item) => item.category))).sort((a, b) => a.localeCompare(b))], [items]);
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
  const updateItem = (id: string, patch: Partial<CatalogItem>) => setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  return (
    <section className="panel lg:col-span-2">
      <div className="panel-header">
        <div>
          <h2>Items</h2>
          <p>Full catalog view with editable pricing, MSRP, inventory, and notes.</p>
        </div>
        <button
          className="button-primary"
          onClick={() =>
            setItems((current) => [
              ...current,
              { id: makeId("item"), sku: "NEW-SKU", name: "New Item", category: "Other", unitPrice: 0, msrp: 0, vendor: "Manual", inventory: 0 },
            ])
          }
        >
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
                <input className="input" list="item-category-options" value={item.category} onChange={(event) => updateItem(item.id, { category: event.target.value })} placeholder="Type or choose a category" />
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
            </div>
          </details>
        ))}
        <datalist id="item-category-options">
          {categories
            .filter((option) => option !== "All")
            .map((option) => (
              <option key={option} value={option} />
            ))}
        </datalist>
      </div>
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
  return (
    <section className="panel lg:col-span-2">
      <div className="panel-header">
        <div>
          <h2>Templates</h2>
          <p>Preset one-door, two-door, and site quote packages.</p>
        </div>
      </div>
      <div className="grid gap-3 p-4 md:grid-cols-3">
        {templates.map((template) => (
          <article key={template.id} className="rounded-lg border border-stone-200 bg-stone-50 p-4">
            <input
              className="input font-black"
              value={template.name}
              onChange={(event) => setTemplates((current) => current.map((candidate) => (candidate.id === template.id ? { ...candidate, name: event.target.value } : candidate)))}
            />
            <textarea
              className="textarea mt-3"
              value={template.description}
              onChange={(event) => setTemplates((current) => current.map((candidate) => (candidate.id === template.id ? { ...candidate, description: event.target.value } : candidate)))}
            />
            <div className="mt-3 grid gap-2">
              {template.lines.map((line) => {
                const item = items.find((candidate) => candidate.id === line.itemId);
                return (
                  <div key={`${template.id}-${line.itemId}`} className="flex items-center justify-between rounded-md bg-white p-2 text-sm">
                    <span>{item?.name ?? line.itemId}</span>
                    <strong>Qty {line.quantity}</strong>
                  </div>
                );
              })}
            </div>
            <button className="button-primary mt-4 w-full" onClick={() => onAddTemplate(template)}>
              Add to Quote
            </button>
          </article>
        ))}
      </div>
    </section>
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
          {["Account Info", "Database", "ServiceTitan", "ADI MSRP", "Sync"].map((item) => (
            <button key={item} className="rounded-md px-3 py-2 text-left font-bold hover:bg-white">
              {item}
            </button>
          ))}
        </div>
        <div className="grid gap-4">
          <section className="rounded-lg border border-stone-200 bg-stone-50 p-4">
            <h3 className="font-black">Account Info</h3>
            <p className="mt-2 text-sm text-stone-600">User placeholder. Microsoft Azure SSO can be connected here later.</p>
          </section>
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
            <div className="flex flex-wrap items-center gap-3 md:col-span-2">
              <button className="button-primary" onClick={onSync}>
                Sync
              </button>
              <span className="text-sm text-stone-600">Last sync: {settings.lastSyncAt ? new Date(settings.lastSyncAt).toLocaleString() : "Never"}</span>
            </div>
          </section>
        </div>
      </div>
    </section>
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
