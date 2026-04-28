const seedItems = [
  ["axis-p3265", "Axis P3265-LVE Dome Camera", "Cameras", "Outdoor-ready network dome camera for entry and lobby coverage.", 879, 0],
  ["honeywell-netaxs", "Honeywell NetAXS-123 Panel", "Access Panels", "Door access controller with enclosure and power supply allowance.", 1295, 0],
  ["honeywell-reader", "Honeywell Proximity Reader", "Access Panels", "Wall-mounted card reader for single controlled opening.", 245, 0],
  ["assa-9600", "ASSA ABLOY 9600 Electric Strike", "Door Hardware", "Heavy-duty electric strike for cylindrical or mortise locksets.", 398, 0],
  ["door-contact", "Door Position Contact", "Door Hardware", "Monitored contact for forced-open and held-open reporting.", 48, 0],
  ["install-labor", "Installation Labor", "Labor", "Technician labor for mounting, wiring, trim-out, and testing.", 115, null],
].map(([id, name, category, description, unitPrice, inventory]) => ({
  id,
  sourceId: `local-${id}`,
  name,
  category,
  description,
  unitPrice,
  inventory,
  source: "Local",
  lastSyncedAt: null,
}));

const categories = ["All", "Cameras", "Access Panels", "Door Hardware", "Labor"];
const keys = { items: "door-access-items", templates: "door-access-quote-templates", quotes: "door-access-quotes" };
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const $ = (id) => document.querySelector(id);

let items = load(keys.items, seedItems);
let templates = load(keys.templates, []);
let quotes = load(keys.quotes, []);
let category = "All";
let query = "";
let lines = ["honeywell-netaxs", "honeywell-reader", "assa-9600", "install-labor"]
  .map((id) => makeLine(items.find((item) => item.id === id)))
  .filter(Boolean);
let quote = {
  customer: "Customer Name",
  project: "Main entrance access control",
  quoteNumber: "Q-1001",
  taxRate: 8.25,
  margin: 20,
  terms:
    "Includes standard installation during normal business hours. Final pricing subject to site survey, cable pathways, door condition, and authority requirements.",
};

const el = {
  search: $("#search"),
  categoryTabs: $("#category-tabs"),
  catalogList: $("#catalog-list"),
  quoteLines: $("#quote-lines"),
  customer: $("#customer"),
  quoteNumber: $("#quote-number"),
  project: $("#project"),
  margin: $("#margin"),
  tax: $("#tax"),
  terms: $("#terms"),
  subtotal: $("#subtotal"),
  marginAmount: $("#margin-amount"),
  taxAmount: $("#tax-amount"),
  total: $("#total"),
  templateName: $("#template-name"),
  templateList: $("#template-list"),
  quoteList: $("#quote-list"),
  previewProject: $("#preview-project"),
  previewCustomer: $("#preview-customer"),
  previewQuote: $("#preview-quote"),
  previewLines: $("#preview-lines"),
  previewTerms: $("#preview-terms"),
  saveTemplate: $("#save-template"),
  saveQuote: $("#save-quote"),
  generatePdf: $("#generate-pdf"),
  syncItems: $("#sync-items"),
  copySummary: $("#copy-summary"),
  printQuote: $("#print-quote"),
  dataMode: $("#data-mode"),
  dataStatus: $("#data-status"),
};

function load(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function html(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function makeLine(item) {
  if (!item) return null;
  return { ...item, lineId: crypto.randomUUID(), quantity: item.category === "Labor" ? 4 : 1, notes: item.description };
}

function clone(currentLines) {
  return currentLines.map((line) => ({ ...line, lineId: crypto.randomUUID() }));
}

function totals(currentLines = lines) {
  const subtotal = currentLines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const marginAmount = subtotal * (quote.margin / 100);
  const taxAmount = (subtotal + marginAmount) * (quote.taxRate / 100);
  return { subtotal, marginAmount, taxAmount, total: subtotal + marginAmount + taxAmount };
}

async function api(path, options = {}) {
  const response = await fetch(path, { headers: { "Content-Type": "application/json" }, ...options });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

async function hydrate() {
  try {
    const [itemData, templateData, quoteData] = await Promise.all([api("/api/items"), api("/api/templates"), api("/api/quotes")]);
    items = itemData.items?.length ? itemData.items : items;
    templates = templateData.templates || templates;
    quotes = quoteData.quotes || quotes;
    save(keys.items, items);
    save(keys.templates, templates);
    save(keys.quotes, quotes);
    el.dataMode.textContent = itemData.mode === "database" ? "Database connected" : "Local fallback";
    el.dataStatus.textContent =
      itemData.mode === "database"
        ? "Items, templates, and quotes are using the configured database API."
        : "Using browser/server fallback until a database API is configured.";
  } catch {
    el.dataMode.textContent = "Browser storage";
    el.dataStatus.textContent = "API unavailable locally. Changes are saved in this browser.";
  }
  render();
}

function render() {
  renderInputs();
  renderCategories();
  renderCatalog();
  renderLines();
  renderPreview();
  renderTemplates();
  renderQuotes();
}

function renderInputs() {
  el.customer.value = quote.customer;
  el.project.value = quote.project;
  el.quoteNumber.value = quote.quoteNumber;
  el.margin.value = quote.margin;
  el.tax.value = quote.taxRate;
  el.terms.value = quote.terms;
  el.templateName.value ||= "Single door access package";
}

function renderCategories() {
  el.categoryTabs.innerHTML = categories
    .map((name) => `<button class="tab-button ${name === category ? "active" : ""}" type="button" data-category="${name}">${name}</button>`)
    .join("");
}

function renderCatalog() {
  const needle = query.trim().toLowerCase();
  el.catalogList.innerHTML = items
    .filter((item) => {
      const haystack = `${item.name} ${item.description} ${item.category} ${item.sourceId || ""}`.toLowerCase();
      return (category === "All" || item.category === category) && (!needle || haystack.includes(needle));
    })
    .map(
      (item) => `
        <article class="catalog-item">
          <div class="item-main">
            <div>
              <h3>${html(item.name)}</h3>
              <p>${html(item.description)}</p>
              <p class="item-meta">${html(item.source || "Local")} ${item.sourceId ? `ID: ${html(item.sourceId)}` : ""} ${
                item.inventory === null || item.inventory === undefined ? "" : `Stock: ${item.inventory}`
              }</p>
            </div>
            <span class="price">${money.format(item.unitPrice)}</span>
          </div>
          <div class="item-actions">
            <button class="button secondary" type="button" data-add="${item.id}">+ Add item</button>
            <button class="button ghost" type="button" data-edit="${item.id}">Edit</button>
          </div>
        </article>`,
    )
    .join("");
}

function renderLines() {
  if (!lines.length) {
    el.quoteLines.innerHTML = '<div class="empty-state"><div>Add catalog items to start a quote.</div></div>';
    return;
  }
  el.quoteLines.innerHTML = `
    <div class="quote-table">
      <table>
        <thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Notes</th><th>Total</th><th></th></tr></thead>
        <tbody>
          ${lines
            .map(
              (line) => `
                <tr>
                  <td class="cell-name"><input class="input" data-line="${line.lineId}" data-field="name" value="${html(line.name)}" /></td>
                  <td><input class="input number-input" type="number" min="0" step="1" data-line="${line.lineId}" data-field="quantity" value="${line.quantity}" /></td>
                  <td><input class="input money-input" type="number" min="0" step="0.01" data-line="${line.lineId}" data-field="unitPrice" value="${line.unitPrice}" /></td>
                  <td class="cell-notes"><textarea class="textarea" data-line="${line.lineId}" data-field="notes">${html(line.notes)}</textarea></td>
                  <td class="line-total">${money.format(line.quantity * line.unitPrice)}</td>
                  <td><button class="button ghost icon" type="button" data-remove="${line.lineId}">x</button></td>
                </tr>`,
            )
            .join("")}
        </tbody>
      </table>
    </div>`;
}

function renderPreview() {
  const quoteTotals = totals();
  el.subtotal.textContent = money.format(quoteTotals.subtotal);
  el.marginAmount.textContent = money.format(quoteTotals.marginAmount);
  el.taxAmount.textContent = money.format(quoteTotals.taxAmount);
  el.total.textContent = money.format(quoteTotals.total);
  el.previewProject.textContent = quote.project;
  el.previewCustomer.textContent = quote.customer;
  el.previewQuote.textContent = quote.quoteNumber;
  el.previewTerms.textContent = quote.terms;
  el.previewLines.innerHTML = lines
    .map(
      (line) => `
        <div class="preview-line">
          <div><h4>${line.quantity} x ${html(line.name)}</h4><p>${html(line.notes)}</p></div>
          <strong>${money.format(line.quantity * line.unitPrice)}</strong>
        </div>`,
    )
    .join("");
}

function renderTemplates() {
  el.templateList.innerHTML = templates
    .map(
      (template) => `
        <article class="template-item">
          <div class="item-main"><div><h3>${html(template.name)}</h3><p>${template.lines.length} quote lines</p></div></div>
          <div class="top-actions">
            <button class="button secondary" type="button" data-load-template="${template.id}">Load</button>
            <button class="button ghost icon" type="button" data-delete-template="${template.id}">x</button>
          </div>
        </article>`,
    )
    .join("");
}

function renderQuotes() {
  el.quoteList.innerHTML = quotes
    .slice(0, 5)
    .map(
      (saved) => `
        <article class="template-item">
          <div class="item-main"><div><h3>${html(saved.quoteNumber)} - ${html(saved.customer)}</h3><p>${html(saved.project)} - ${money.format(saved.totals?.total || 0)}</p></div></div>
          <button class="button secondary" type="button" data-load-quote="${saved.id}">Open</button>
        </article>`,
    )
    .join("");
}

async function persist(collection, item) {
  const key = keys[collection];
  const list = collection === "items" ? items : collection === "templates" ? templates : quotes;
  const next = [item, ...list.filter((current) => current.id !== item.id)];
  if (collection === "items") items = next;
  if (collection === "templates") templates = next;
  if (collection === "quotes") quotes = next;
  save(key, next);
  try {
    const data = await api(`/api/${collection}`, { method: "POST", body: JSON.stringify(item) });
    if (data[collection]) {
      if (collection === "items") items = data[collection];
      if (collection === "templates") templates = data[collection];
      if (collection === "quotes") quotes = data[collection];
      save(key, data[collection]);
    }
    el.dataStatus.textContent = `${collection.slice(0, -1)} saved to backend.`;
  } catch {
    el.dataStatus.textContent = `${collection.slice(0, -1)} saved locally. Configure database API for shared storage.`;
  }
  render();
}

function currentQuote() {
  return {
    id: crypto.randomUUID(),
    ...quote,
    lines: clone(lines),
    totals: totals(),
    createdAt: new Date().toISOString(),
  };
}

function generatePdf() {
  const quoteTotals = totals();
  const rows = lines
    .map((line) => `<tr><td>${html(line.name)}</td><td>${line.quantity}</td><td>${money.format(line.unitPrice)}</td><td>${money.format(line.quantity * line.unitPrice)}</td></tr>`)
    .join("");
  const doc = window.open("", "_blank");
  doc.document.write(`<!doctype html><html><head><title>${html(quote.quoteNumber)}</title><style>body{font-family:Arial,sans-serif;margin:32px;color:#111}table{width:100%;border-collapse:collapse;margin-top:20px}td,th{border-bottom:1px solid #ddd;padding:10px;text-align:left}.totals{margin-left:auto;width:280px;margin-top:20px}.totals div{display:flex;justify-content:space-between;padding:5px 0}.total{border-top:2px solid #111;font-weight:bold;font-size:18px}.terms{margin-top:28px;color:#555;font-size:13px}</style></head><body><h1>${html(quote.project)}</h1><p>Customer: ${html(quote.customer)}<br>Quote: ${html(quote.quoteNumber)}<br>Date: ${new Date().toLocaleDateString()}</p><table><thead><tr><th>Item</th><th>Quantity</th><th>Unit Price</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table><div class="totals"><div><span>Subtotal</span><strong>${money.format(quoteTotals.subtotal)}</strong></div><div><span>Margin</span><strong>${money.format(quoteTotals.marginAmount)}</strong></div><div><span>Tax</span><strong>${money.format(quoteTotals.taxAmount)}</strong></div><div class="total"><span>Total</span><strong>${money.format(quoteTotals.total)}</strong></div></div><p class="terms">${html(quote.terms)}</p><script>window.addEventListener("load",()=>window.print())</script></body></html>`);
  doc.document.close();
}

el.search.addEventListener("input", (event) => {
  query = event.target.value;
  renderCatalog();
});
el.categoryTabs.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  category = button.dataset.category;
  renderCategories();
  renderCatalog();
});
el.catalogList.addEventListener("click", async (event) => {
  const add = event.target.closest("[data-add]");
  const edit = event.target.closest("[data-edit]");
  if (add) {
    lines = [...lines, makeLine(items.find((item) => item.id === add.dataset.add))].filter(Boolean);
    renderLines();
    renderPreview();
  }
  if (edit) {
    const item = items.find((candidate) => candidate.id === edit.dataset.edit);
    const unitPrice = Number(prompt("Unit price", item.unitPrice));
    if (Number.isNaN(unitPrice)) return;
    const inventoryValue = prompt("Inventory count, leave blank for labor or unknown", item.inventory ?? "");
    await persist("items", { ...item, unitPrice, inventory: inventoryValue === "" ? null : Number(inventoryValue), source: item.source || "Manual override" });
  }
});
el.quoteLines.addEventListener("input", (event) => {
  const input = event.target.closest("[data-line]");
  if (!input) return;
  lines = lines.map((line) => {
    if (line.lineId !== input.dataset.line) return line;
    const value = ["quantity", "unitPrice"].includes(input.dataset.field) ? Number(input.value) : input.value;
    return { ...line, [input.dataset.field]: value };
  });
  renderPreview();
});
el.quoteLines.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove]");
  if (!button) return;
  lines = lines.filter((line) => line.lineId !== button.dataset.remove);
  renderLines();
  renderPreview();
});
[
  ["customer", "customer"],
  ["quoteNumber", "quoteNumber"],
  ["project", "project"],
  ["margin", "margin"],
  ["tax", "taxRate"],
  ["terms", "terms"],
].forEach(([elementKey, quoteKey]) => {
  el[elementKey].addEventListener("input", (event) => {
    quote[quoteKey] = ["margin", "taxRate"].includes(quoteKey) ? Number(event.target.value) : event.target.value;
    renderPreview();
  });
});
el.saveTemplate.addEventListener("click", () => {
  const name = el.templateName.value.trim();
  if (name && lines.length) persist("templates", { id: crypto.randomUUID(), name, lines: clone(lines), createdAt: new Date().toISOString() });
});
el.saveQuote.addEventListener("click", () => lines.length && persist("quotes", currentQuote()));
el.generatePdf.addEventListener("click", generatePdf);
el.syncItems.addEventListener("click", async () => {
  el.dataStatus.textContent = "Checking ServiceTitan sync endpoint...";
  try {
    const data = await api("/api/sync-servicetitan", { method: "POST" });
    items = data.items?.length ? data.items : items;
    save(keys.items, items);
    el.dataStatus.textContent = data.message || "ServiceTitan sync completed.";
    renderCatalog();
  } catch {
    el.dataStatus.textContent = "ServiceTitan is not configured yet. Add credentials in Vercel.";
  }
});
el.templateList.addEventListener("click", (event) => {
  const loadButton = event.target.closest("[data-load-template]");
  const deleteButton = event.target.closest("[data-delete-template]");
  if (loadButton) {
    const template = templates.find((item) => item.id === loadButton.dataset.loadTemplate);
    lines = clone(template.lines);
    el.templateName.value = template.name;
    renderLines();
    renderPreview();
  }
  if (deleteButton) {
    templates = templates.filter((item) => item.id !== deleteButton.dataset.deleteTemplate);
    save(keys.templates, templates);
    renderTemplates();
  }
});
el.quoteList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-load-quote]");
  if (!button) return;
  const saved = quotes.find((item) => item.id === button.dataset.loadQuote);
  quote = { customer: saved.customer, project: saved.project, quoteNumber: saved.quoteNumber, taxRate: saved.taxRate, margin: saved.margin, terms: saved.terms };
  lines = clone(saved.lines);
  render();
});
el.copySummary.addEventListener("click", async () => {
  const quoteTotals = totals();
  await navigator.clipboard.writeText([
    `${quote.quoteNumber} - ${quote.project}`,
    `Customer: ${quote.customer}`,
    "",
    ...lines.map((line) => `${line.quantity} x ${line.name} @ ${money.format(line.unitPrice)} = ${money.format(line.quantity * line.unitPrice)}`),
    "",
    `Subtotal: ${money.format(quoteTotals.subtotal)}`,
    `Margin: ${money.format(quoteTotals.marginAmount)}`,
    `Tax: ${money.format(quoteTotals.taxAmount)}`,
    `Total: ${money.format(quoteTotals.total)}`,
  ].join("\n"));
});
el.printQuote.addEventListener("click", () => window.print());

render();
hydrate();
