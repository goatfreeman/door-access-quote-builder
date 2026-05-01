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
  msrp: null,
  inventory,
  source: "Local",
  lastSyncedAt: null,
}));

const categories = ["All", "Cameras", "Access Panels", "Door Hardware", "Labor"];
const packageDefinitions = [
  {
    id: "one-door",
    name: "One Door Setup",
    description: "Card reader, panel allowance, door strike, contact, and install labor.",
    lines: [
      ["honeywell-netaxs", 1],
      ["honeywell-reader", 1],
      ["assa-9600", 1],
      ["door-contact", 1],
      ["install-labor", 4],
    ],
  },
  {
    id: "two-door",
    name: "Two Door Setup",
    description: "Two openings with readers, strikes, contacts, panel allowance, and labor.",
    lines: [
      ["honeywell-netaxs", 1],
      ["honeywell-reader", 2],
      ["assa-9600", 2],
      ["door-contact", 2],
      ["install-labor", 8],
    ],
  },
  {
    id: "site",
    name: "Whole Site Setup",
    description: "Starter site package with access control, camera coverage, and labor allowance.",
    lines: [
      ["honeywell-netaxs", 2],
      ["honeywell-reader", 4],
      ["assa-9600", 4],
      ["door-contact", 4],
      ["axis-p3265", 4],
      ["install-labor", 20],
    ],
  },
];
const keys = {
  items: "door-access-items",
  templates: "door-access-quote-templates",
  quotes: "door-access-quotes",
  settings: "door-access-settings",
  lastSync: "door-access-last-sync",
};
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const $ = (id) => document.querySelector(id);

let items = load(keys.items, seedItems);
let templates = load(keys.templates, []);
let quotes = load(keys.quotes, []);
let settings = load(keys.settings, { serviceTitan: { baseUrl: "", tenantId: "", clientId: "", clientSecret: "" } });
let category = "All";
let itemCategory = "All";
let query = "";
let itemQuery = "";
let activeView = "quote-view";
let mobileStep = "pick";
let notifications = [];
let selectedPreviousQuoteId = null;
let lines = ["honeywell-netaxs", "honeywell-reader", "assa-9600", "install-labor"]
  .map((id) => makeLine(items.find((item) => item.id === id)))
  .filter(Boolean);
let quote = {
  id: null,
  customer: "Customer Name",
  project: "Main entrance access control",
  quoteNumber: "Q-1001",
  taxRate: 8.25,
  margin: 20,
  terms:
    "Includes standard installation during normal business hours. Final pricing subject to site survey, cable pathways, door condition, and authority requirements.",
};
let cleanQuoteState = "";

const el = {
  viewButtons: document.querySelectorAll("[data-view]"),
  search: $("#search"),
  itemSearch: $("#item-search"),
  categoryTabs: $("#category-tabs"),
  itemCategoryTabs: $("#item-category-tabs"),
  catalogList: $("#catalog-list"),
  itemsTable: $("#items-table"),
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
  mobileFlow: $(".mobile-flow"),
  bottomTotalToggle: $("#bottom-total-toggle"),
  bottomTotalDetails: $("#bottom-total-details"),
  bottomTotal: $("#bottom-total"),
  bottomSubtotal: $("#bottom-subtotal"),
  bottomMarginAmount: $("#bottom-margin-amount"),
  bottomTaxAmount: $("#bottom-tax-amount"),
  bottomCartList: $("#bottom-cart-list"),
  desktopCartList: $("#desktop-cart-list"),
  cartCountBadge: $("#cart-count-badge"),
  finalCartList: $("#final-cart-list"),
  finalSubtotal: $("#final-subtotal"),
  finalMarginAmount: $("#final-margin-amount"),
  finalTaxAmount: $("#final-tax-amount"),
  finalTotal: $("#final-total"),
  templateName: $("#template-name"),
  templateList: $("#template-list"),
  quoteList: $("#quote-list"),
  previousQuoteList: $("#previous-quote-list"),
  previewProject: $("#preview-project"),
  previewCustomer: $("#preview-customer"),
  previewQuote: $("#preview-quote"),
  previewLines: $("#preview-lines"),
  previewTerms: $("#preview-terms"),
  saveTemplate: $("#save-template"),
  headerNextQuote: $("#header-next-quote"),
  addItem: $("#add-item"),
  openSettings: $("#open-settings"),
  closeSettings: $("#close-settings"),
  settingsDialog: $("#settings-dialog"),
  settingsSync: $("#settings-sync"),
  saveSettings: $("#save-settings"),
  lastSyncTime: $("#last-sync-time"),
  stBaseUrl: $("#st-base-url"),
  stTenantId: $("#st-tenant-id"),
  stClientId: $("#st-client-id"),
  stClientSecret: $("#st-client-secret"),
  includeLabor: $("#include-labor"),
  laborQty: $("#labor-qty"),
  laborRate: $("#labor-rate"),
  copySummary: $("#copy-summary"),
  openNotifications: $("#open-notifications"),
  closeNotifications: $("#close-notifications"),
  notificationsDialog: $("#notifications-dialog"),
  notificationList: $("#notification-list"),
  notificationDot: $("#notification-dot"),
  confirmDialog: $("#confirm-dialog"),
  confirmTitle: $("#confirm-title"),
  confirmMessage: $("#confirm-message"),
  confirmOk: $("#confirm-ok"),
  confirmCancel: $("#confirm-cancel"),
  promptDialog: $("#prompt-dialog"),
  promptTitle: $("#prompt-title"),
  promptMessage: $("#prompt-message"),
  promptInput: $("#prompt-input"),
  openMenu: $("#open-menu"),
  closeMenu: $("#close-menu"),
  drawerBackdrop: $("#drawer-backdrop"),
  mobileDrawer: $("#mobile-drawer"),
  drawerSettings: $("#drawer-settings"),
  bottomNextQuote: $("#bottom-next-quote"),
  desktopNextQuote: $("#desktop-next-quote"),
  finalSaveQuote: $("#final-save-quote"),
  finalGeneratePdf: $("#final-generate-pdf"),
  finalPrintQuote: $("#final-print-quote"),
};

document.body.dataset.activeView = activeView;

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

function lastSyncLabel() {
  const value = localStorage.getItem(keys.lastSync);
  return value ? new Date(value).toLocaleString() : "Never";
}

function html(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function makeLine(item) {
  if (!item) return null;
  return { ...item, lineId: crypto.randomUUID(), quantity: item.category === "Labor" ? 4 : 1, notes: item.description };
}

function makePackageLine(item, quantity, packageName) {
  const line = makeLine(item);
  if (!line) return null;
  return { ...line, quantity, packageName };
}

function quoteState() {
  return JSON.stringify({ quote, lines });
}

function markClean() {
  cleanQuoteState = quoteState();
}

function isQuoteDirty() {
  return quoteState() !== cleanQuoteState;
}

function restoreCleanQuote() {
  if (!cleanQuoteState) return;
  const snapshot = JSON.parse(cleanQuoteState);
  quote = snapshot.quote;
  lines = snapshot.lines;
  markClean();
}

function addNotification(message, type = "info") {
  notifications = [{ id: crypto.randomUUID(), message, type, createdAt: new Date().toISOString() }, ...notifications].slice(0, 12);
  renderNotifications();
}

function renderNotifications() {
  if (!notifications.length) {
    el.notificationList.innerHTML = '<div class="empty-state compact-empty"><div>No notifications yet.</div></div>';
    el.notificationDot.hidden = true;
    return;
  }
  el.notificationDot.hidden = false;
  el.notificationList.innerHTML = notifications
    .map((note) => `<article class="notification-item ${note.type}"><strong>${html(new Date(note.createdAt).toLocaleTimeString())}</strong><p>${html(note.message)}</p></article>`)
    .join("");
}

function showConfirm({ title = "Confirm", message = "", confirmLabel = "Continue", cancelLabel = "Cancel" }) {
  return new Promise((resolve) => {
    el.confirmTitle.textContent = title;
    el.confirmMessage.textContent = message;
    el.confirmOk.textContent = confirmLabel;
    el.confirmCancel.textContent = cancelLabel;
    el.confirmDialog.addEventListener("close", () => resolve(el.confirmDialog.returnValue === "confirm"), { once: true });
    el.confirmDialog.showModal();
  });
}

function showPrompt({ title = "Input", message = "", value = "", inputType = "text" }) {
  return new Promise((resolve) => {
    el.promptTitle.textContent = title;
    el.promptMessage.textContent = message;
    el.promptInput.type = inputType;
    el.promptInput.value = value;
    el.promptDialog.addEventListener("close", () => {
      resolve(el.promptDialog.returnValue === "confirm" ? el.promptInput.value : null);
    }, { once: true });
    el.promptDialog.showModal();
    setTimeout(() => el.promptInput.focus(), 0);
  });
}

async function switchView(viewId) {
  if (["quote-view", "finalize-view"].includes(activeView) && !["quote-view", "finalize-view", "settings-view"].includes(viewId) && isQuoteDirty()) {
    const discard = await showConfirm({
      title: "Discard quote edits?",
      message: "You have unsaved quote changes. Discard them and switch pages?",
      confirmLabel: "Discard",
    });
    if (!discard) {
      closeMobileMenu();
      return;
    }
    restoreCleanQuote();
    render();
  }
  document.querySelectorAll(".page-view").forEach((view) => view.classList.remove("active"));
  const next = $(`#${viewId}`);
  if (next) next.classList.add("active");
  activeView = viewId;
  document.body.dataset.activeView = viewId;
  closeMobileMenu();
}

function openMobileMenu() {
  el.mobileDrawer.classList.add("open");
  el.mobileDrawer.setAttribute("aria-hidden", "false");
  el.drawerBackdrop.hidden = false;
}

function closeMobileMenu() {
  el.mobileDrawer.classList.remove("open");
  el.mobileDrawer.setAttribute("aria-hidden", "true");
  el.drawerBackdrop.hidden = true;
}

function laborLine() {
  return lines.find((line) => line.category === "Labor");
}

function syncLaborInputs() {
  const labor = laborLine();
  el.includeLabor.checked = Boolean(labor);
  el.laborQty.disabled = !labor;
  el.laborRate.disabled = !labor;
  el.laborQty.value = labor?.quantity ?? 0;
  el.laborRate.value = labor?.unitPrice ?? items.find((item) => item.category === "Labor")?.unitPrice ?? 0;
}

function setLabor(enabled) {
  const labor = laborLine();
  if (!enabled) {
    lines = lines.filter((line) => line.category !== "Labor");
  } else if (!labor) {
    lines = [...lines, makeLine(items.find((item) => item.category === "Labor"))].filter(Boolean);
  }
  syncLaborInputs();
  renderLines();
  renderPreview();
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

function quoteDateLabel(saved) {
  const value = saved.createdAt || saved.updatedAt;
  return value ? new Date(value).toLocaleDateString() : "No date";
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
    addNotification(
      itemData.mode === "database"
        ? "Database connected. Items, templates, and quotes are using shared storage."
        : "Using local fallback storage until a shared database API is configured.",
      itemData.mode === "database" ? "success" : "info",
    );
  } catch {
    addNotification("API unavailable locally. Changes are saved in this browser.", "info");
  }
  markClean();
  render();
}

function render() {
  renderMobileStep();
  renderInputs();
  renderCategories();
  renderItemCategories();
  renderCatalog();
  renderItemsTable();
  renderLines();
  renderPreview();
  renderTemplates();
  renderQuotes();
  renderPreviousQuotes();
  renderSettings();
  renderNotifications();
}

function renderMobileStep() {
  const quoteView = $("#quote-view");
  quoteView.classList.remove("mobile-step-pick", "mobile-step-customize", "mobile-step-review");
  quoteView.classList.add(`mobile-step-${mobileStep}`);
  el.mobileFlow.querySelectorAll("[data-mobile-step]").forEach((button) => {
    const isActive = button.dataset.mobileStep === mobileStep;
    button.classList.toggle("active", isActive);
    if (isActive) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
  });
}

function renderInputs() {
  el.customer.value = quote.customer;
  el.project.value = quote.project;
  el.quoteNumber.value = quote.quoteNumber;
  el.margin.value = quote.margin;
  el.tax.value = quote.taxRate;
  el.terms.value = quote.terms;
  el.templateName.value ||= "Standard quote package";
  syncLaborInputs();
}

function renderCategories() {
  el.categoryTabs.innerHTML = categories
    .map((name) => `<button class="tab-button ${name === category ? "active" : ""}" type="button" data-category="${name}">${name}</button>`)
    .join("");
}

function renderItemCategories() {
  el.itemCategoryTabs.innerHTML = categories
    .map((name) => `<button class="tab-button ${name === itemCategory ? "active" : ""}" type="button" data-item-category="${name}">${name}</button>`)
    .join("");
}

function renderCatalog() {
  const needle = query.trim().toLowerCase();
  const setupCards = packageDefinitions
    .map(
      (setup) => `
        <article class="catalog-item setup-card">
          <div class="item-main">
            <div>
              <h3>${html(setup.name)}</h3>
              <p>${html(setup.description)}</p>
              <p class="item-meta">${setup.lines.length} pre-canned quote items</p>
            </div>
          </div>
          <div class="item-actions">
            <button class="button" type="button" data-add-package="${setup.id}">Use setup</button>
          </div>
        </article>`,
    )
    .join("");
  const itemCards = items
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
              } ${item.msrp ? `MSRP: ${money.format(item.msrp)}` : ""}</p>
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
  el.catalogList.innerHTML = `${setupCards}${itemCards}`;
}

function renderItemsTable() {
  const needle = itemQuery.trim().toLowerCase();
  el.itemsTable.innerHTML = items
    .filter((item) => {
      const haystack = `${item.name} ${item.description} ${item.category} ${item.sourceId || ""}`.toLowerCase();
      return (itemCategory === "All" || item.category === itemCategory) && (!needle || haystack.includes(needle));
    })
    .map(
      (item) => `
        <tr data-item-row="${item.id}">
          <td data-label="Name"><input class="input" data-item-field="name" value="${html(item.name)}" /></td>
          <td data-label="Category">
            <select class="input" data-item-field="category">
              ${categories
                .filter((name) => name !== "All")
                .map((name) => `<option value="${name}" ${item.category === name ? "selected" : ""}>${name}</option>`)
                .join("")}
            </select>
          </td>
          <td data-label="Price"><input class="input money-input" type="number" min="0" step="0.01" data-item-field="unitPrice" value="${item.unitPrice}" /></td>
          <td data-label="MSRP"><input class="input money-input" type="number" min="0" step="0.01" data-item-field="msrp" value="${item.msrp ?? ""}" /></td>
          <td data-label="Inventory"><input class="input number-input" type="number" min="0" step="1" data-item-field="inventory" value="${item.inventory ?? ""}" /></td>
          <td data-label="Source ID"><input class="input" data-item-field="sourceId" value="${html(item.sourceId || "")}" /></td>
          <td class="description-cell" data-label="Description"><textarea class="textarea" data-item-field="description">${html(item.description)}</textarea></td>
          <td data-label="Actions">
            <button class="button secondary compact" type="button" data-save-item="${item.id}">Save</button>
            <button class="button ghost icon" type="button" data-delete-item="${item.id}">x</button>
          </td>
        </tr>`,
    )
    .join("");
}

function renderSettings() {
  el.stBaseUrl.value = settings.serviceTitan?.baseUrl || "";
  el.stTenantId.value = settings.serviceTitan?.tenantId || "";
  el.stClientId.value = settings.serviceTitan?.clientId || "";
  el.stClientSecret.value = settings.serviceTitan?.clientSecret || "";
  el.lastSyncTime.textContent = lastSyncLabel();
}

function renderLines() {
  if (!lines.length) {
    el.quoteLines.innerHTML = '<div class="empty-state"><div>Add catalog items to start a quote.</div></div>';
    return;
  }
  el.quoteLines.innerHTML = `<div class="quote-line-cards">
    ${lines
      .map(
        (line) => `
          <article class="quote-line-card">
            <div class="quote-line-summary">
              <div>
                ${line.packageName ? `<span class="package-pill">${html(line.packageName)}</span>` : ""}
                <input class="input line-name-input" data-line="${line.lineId}" data-field="name" value="${html(line.name)}" />
              </div>
              <label class="compact-field">
                <span>Qty</span>
                <input class="input number-input" type="number" min="0" step="1" data-line="${line.lineId}" data-field="quantity" value="${line.quantity}" />
              </label>
              <strong class="line-total">${money.format(line.quantity * line.unitPrice)}</strong>
              <details class="line-details">
                <summary aria-label="Edit item details"><span aria-hidden="true">⌄</span></summary>
                <div class="line-detail-grid">
                  <label class="field">
                    <span>Unit price</span>
                    <input class="input money-input" type="number" min="0" step="0.01" data-line="${line.lineId}" data-field="unitPrice" value="${line.unitPrice}" />
                  </label>
                  <label class="field full">
                    <span>Notes</span>
                    <textarea class="textarea" data-line="${line.lineId}" data-field="notes">${html(line.notes)}</textarea>
                  </label>
                </div>
              </details>
              <button class="button ghost icon" type="button" data-remove="${line.lineId}" aria-label="Remove item">x</button>
            </div>
          </article>`,
      )
      .join("")}
    </div>`;
}

function renderPreview() {
  const quoteTotals = totals();
  el.subtotal.textContent = money.format(quoteTotals.subtotal);
  el.marginAmount.textContent = money.format(quoteTotals.marginAmount);
  el.taxAmount.textContent = money.format(quoteTotals.taxAmount);
  el.total.textContent = money.format(quoteTotals.total);
  el.bottomSubtotal.textContent = money.format(quoteTotals.subtotal);
  el.bottomMarginAmount.textContent = money.format(quoteTotals.marginAmount);
  el.bottomTaxAmount.textContent = money.format(quoteTotals.taxAmount);
  el.bottomTotal.textContent = money.format(quoteTotals.total);
  el.finalSubtotal.textContent = money.format(quoteTotals.subtotal);
  el.finalMarginAmount.textContent = money.format(quoteTotals.marginAmount);
  el.finalTaxAmount.textContent = money.format(quoteTotals.taxAmount);
  el.finalTotal.textContent = money.format(quoteTotals.total);
  el.cartCountBadge.textContent = lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0);
  renderCartLists();
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

function cartMarkup() {
  if (!lines.length) {
    return '<div class="cart-empty">No items selected.</div>';
  }
  const groups = lines.reduce((acc, line) => {
    const name = line.packageName || "Custom Items";
    if (!acc.has(name)) acc.set(name, []);
    acc.get(name).push(line);
    return acc;
  }, new Map());
  return [...groups.entries()]
    .map(
      ([groupName, groupLines]) => {
        const groupTotal = groupLines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
        return `
        <article class="cart-item cart-group">
          <div class="cart-item-main">
            <strong>${html(groupName)}</strong>
            <span>${groupLines.length} items needed</span>
            <div class="cart-group-lines">
              ${groupLines
                .map(
                  (line) => `
                    <div class="cart-group-line">
                      <span>${html(line.name)}</span>
                      <input class="input cart-qty-input" type="number" min="0" step="1" data-cart-qty="${line.lineId}" value="${line.quantity}" aria-label="Quantity for ${html(line.name)}" />
                      <button class="button ghost icon cart-remove" type="button" data-cart-remove="${line.lineId}" aria-label="Remove ${html(line.name)}">x</button>
                    </div>`,
                )
                .join("")}
            </div>
          </div>
          <div class="cart-controls">
            <strong class="cart-line-total">${money.format(groupTotal)}</strong>
          </div>
        </article>`;
      },
    )
    .join("");
}

function renderCartLists() {
  const markup = cartMarkup();
  el.bottomCartList.innerHTML = markup;
  el.desktopCartList.innerHTML = markup;
  el.finalCartList.innerHTML = markup;
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
    .map(
      (saved) => `
        <article class="template-item">
          <div class="item-main"><div><h3>${html(saved.quoteNumber)} - ${html(saved.customer)}</h3><p>${html(saved.project)} - ${money.format(saved.totals?.total || 0)}</p></div></div>
          <div class="top-actions">
            <button class="button secondary" type="button" data-load-quote="${saved.id}">Open</button>
            <button class="button ghost icon" type="button" data-delete-quote="${saved.id}">x</button>
          </div>
        </article>`,
    )
    .join("");
}

function renderPreviousQuotes() {
  if (!quotes.length) {
    el.previousQuoteList.innerHTML = '<div class="empty-state"><div>No saved quotes yet.</div></div>';
    return;
  }
  el.previousQuoteList.innerHTML = quotes
    .map(
      (saved) => `
        <article class="history-item">
          <div>
            <div class="history-title">
              <h3>${html(saved.quoteNumber)} - ${html(saved.customer)}</h3>
              <span>${quoteDateLabel(saved)}</span>
            </div>
            <p>${html(saved.project)}</p>
            <strong>${money.format(saved.totals?.total || 0)}</strong>
          </div>
          <div class="history-actions">
            <button class="button secondary" type="button" data-preview-quote="${saved.id}">Summary</button>
            <button class="button ghost icon" type="button" data-delete-quote="${saved.id}">x</button>
          </div>
          ${
            selectedPreviousQuoteId === saved.id
              ? `<div class="history-summary">
                  <div class="cart-list">
                    ${saved.lines
                      .map(
                        (line) => `
                          <article class="cart-item">
                            <div class="cart-item-main">
                              <strong>${html(line.packageName || line.name)}</strong>
                              <span>${line.quantity} x ${html(line.name)} at ${money.format(line.unitPrice)}</span>
                            </div>
                            <strong>${money.format(line.quantity * line.unitPrice)}</strong>
                          </article>`,
                      )
                      .join("")}
                  </div>
                  <div class="summary-row summary-total"><span>Quoted total</span><strong>${money.format(saved.totals?.total || 0)}</strong></div>
                  <button class="button secondary" type="button" data-load-quote="${saved.id}">Edit this quote</button>
                </div>`
              : ""
          }
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
    addNotification(`${collection.slice(0, -1)} saved to backend.`, "success");
  } catch {
    addNotification(`${collection.slice(0, -1)} saved locally. Configure database API for shared storage.`, "info");
  }
  if (collection === "quotes") markClean();
  render();
}

async function saveItemFromRow(itemId) {
  const row = document.querySelector(`[data-item-row="${itemId}"]`);
  const existing = items.find((item) => item.id === itemId);
  const next = { ...existing };
  row.querySelectorAll("[data-item-field]").forEach((input) => {
    const field = input.dataset.itemField;
    if (["unitPrice", "msrp"].includes(field)) next[field] = input.value === "" ? null : Number(input.value);
    else if (field === "inventory") next[field] = input.value === "" ? null : Number(input.value);
    else next[field] = input.value;
  });
  next.source = next.source || "Manual override";
  await persist("items", next);
}

function addBlankItem() {
  const item = {
    id: `item-${crypto.randomUUID()}`,
    sourceId: "",
    name: "New item",
    category: "Door Hardware",
    description: "",
    unitPrice: 0,
    msrp: null,
    inventory: 0,
    source: "Manual",
    lastSyncedAt: null,
  };
  items = [item, ...items];
  save(keys.items, items);
  itemCategory = "All";
  render();
}

function saveSettings() {
  settings = {
    serviceTitan: {
      baseUrl: el.stBaseUrl.value.trim(),
      tenantId: el.stTenantId.value.trim(),
      clientId: el.stClientId.value.trim(),
      clientSecret: el.stClientSecret.value,
    },
  };
  save(keys.settings, settings);
  addNotification("Settings saved locally for this browser.", "success");
  renderSettings();
}

function currentQuote() {
  return {
    ...quote,
    id: quote.id || crypto.randomUUID(),
    lines: clone(lines),
    totals: totals(),
    createdAt: quote.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

async function deleteQuote(id) {
  quotes = quotes.filter((saved) => saved.id !== id);
  save(keys.quotes, quotes);
  if (quote.id === id) quote.id = null;
  try {
    const data = await api("/api/quotes", { method: "DELETE", body: JSON.stringify({ id }) });
    quotes = data.quotes || quotes;
    save(keys.quotes, quotes);
    addNotification("Quote removed from backend.", "success");
  } catch {
    addNotification("Quote removed locally. Configure database API for shared storage.", "info");
  }
  renderQuotes();
  renderPreviousQuotes();
}

async function saveCurrentQuote() {
  const saved = currentQuote();
  quote.id = saved.id;
  quote.createdAt = saved.createdAt;
  await persist("quotes", saved);
}

async function customerEmailPrompt() {
  const email = await showPrompt({
    title: "Customer email",
    message: "Enter the customer email for this quote PDF.",
    value: quote.email || "",
    inputType: "email",
  });
  if (email === null) return null;
  quote.email = email.trim();
  return quote.email;
}

function generatePdf(customerEmail = "") {
  const quoteTotals = totals();
  const rows = lines
    .map((line) => `<tr><td>${html(line.name)}</td><td>${line.quantity}</td><td>${money.format(line.unitPrice)}</td><td>${money.format(line.quantity * line.unitPrice)}</td></tr>`)
    .join("");
  const doc = window.open("", "_blank");
  doc.document.write(`<!doctype html><html><head><title>${html(quote.quoteNumber)}</title><style>body{font-family:Arial,sans-serif;margin:32px;color:#111}table{width:100%;border-collapse:collapse;margin-top:20px}td,th{border-bottom:1px solid #ddd;padding:10px;text-align:left}.totals{margin-left:auto;width:280px;margin-top:20px}.totals div{display:flex;justify-content:space-between;padding:5px 0}.total{border-top:2px solid #111;font-weight:bold;font-size:18px}.terms{margin-top:28px;color:#555;font-size:13px}</style></head><body><h1>${html(quote.project)}</h1><p>Customer: ${html(quote.customer)}<br>Quote: ${html(quote.quoteNumber)}<br>Date: ${new Date().toLocaleDateString()}${customerEmail ? `<br>Email: ${html(customerEmail)}` : ""}</p><table><thead><tr><th>Item</th><th>Quantity</th><th>Unit Price</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table><div class="totals"><div><span>Subtotal</span><strong>${money.format(quoteTotals.subtotal)}</strong></div><div><span>Margin</span><strong>${money.format(quoteTotals.marginAmount)}</strong></div><div><span>Tax</span><strong>${money.format(quoteTotals.taxAmount)}</strong></div><div class="total"><span>Total</span><strong>${money.format(quoteTotals.total)}</strong></div></div><p class="terms">${html(quote.terms)}</p><script>window.addEventListener("load",()=>window.print())</script></body></html>`);
  doc.document.close();
}

async function emailQuotePdf() {
  const email = await customerEmailPrompt();
  if (email === null) return;
  generatePdf(email);
  if (email) {
    const subject = encodeURIComponent(`Quote ${quote.quoteNumber} - ${quote.project}`);
    const body = encodeURIComponent(`Hi,\n\nPlease see quote ${quote.quoteNumber} for ${quote.project}.\n\nTotal: ${money.format(totals().total)}\n\nThe PDF is ready to attach from the print window.`);
    window.location.href = `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`;
  }
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
el.itemSearch.addEventListener("input", (event) => {
  itemQuery = event.target.value;
  renderItemsTable();
});
el.itemCategoryTabs.addEventListener("click", (event) => {
  const button = event.target.closest("[data-item-category]");
  if (!button) return;
  itemCategory = button.dataset.itemCategory;
  renderItemCategories();
  renderItemsTable();
});
el.itemsTable.addEventListener("click", async (event) => {
  const saveButton = event.target.closest("[data-save-item]");
  const deleteButton = event.target.closest("[data-delete-item]");
  if (saveButton) await saveItemFromRow(saveButton.dataset.saveItem);
  if (deleteButton) {
    items = items.filter((item) => item.id !== deleteButton.dataset.deleteItem);
    lines = lines.filter((line) => line.id !== deleteButton.dataset.deleteItem);
    save(keys.items, items);
    render();
  }
});
el.addItem.addEventListener("click", addBlankItem);
el.catalogList.addEventListener("click", async (event) => {
  const add = event.target.closest("[data-add]");
  const addPackage = event.target.closest("[data-add-package]");
  const edit = event.target.closest("[data-edit]");
  if (addPackage) {
    const setup = packageDefinitions.find((candidate) => candidate.id === addPackage.dataset.addPackage);
    if (!setup) return;
    const packageLines = setup.lines
      .map(([itemId, quantity]) => makePackageLine(items.find((item) => item.id === itemId), quantity, setup.name))
      .filter(Boolean);
    lines = [...lines, ...packageLines];
    renderLines();
    renderPreview();
    openBottomTotal();
  }
  if (add) {
    lines = [...lines, makeLine(items.find((item) => item.id === add.dataset.add))].filter(Boolean);
    renderLines();
    renderPreview();
    openBottomTotal();
  }
  if (edit) {
    const item = items.find((candidate) => candidate.id === edit.dataset.edit);
    const unitPriceValue = await showPrompt({
      title: "Edit price",
      message: `Unit price for ${item.name}`,
      value: item.unitPrice,
      inputType: "number",
    });
    if (unitPriceValue === null) return;
    const unitPrice = Number(unitPriceValue);
    if (Number.isNaN(unitPrice)) return;
    const inventoryValue = await showPrompt({
      title: "Edit inventory",
      message: "Inventory count, leave blank for labor or unknown.",
      value: item.inventory ?? "",
      inputType: "number",
    });
    if (inventoryValue === null) return;
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
el.settingsSync.addEventListener("click", async () => {
  addNotification("Checking ServiceTitan sync endpoint...", "info");
  try {
    const data = await api("/api/sync-servicetitan", {
      method: "POST",
      body: JSON.stringify(settings.serviceTitan || {}),
    });
    items = data.items?.length ? data.items : items;
    save(keys.items, items);
    localStorage.setItem(keys.lastSync, new Date().toISOString());
    el.lastSyncTime.textContent = lastSyncLabel();
    addNotification(data.message || "ServiceTitan sync completed.", "success");
    render();
  } catch {
    addNotification("ServiceTitan is not configured yet. Add credentials in Vercel.", "info");
  }
});
el.saveSettings.addEventListener("click", saveSettings);
el.openSettings.addEventListener("click", () => el.settingsDialog.showModal());
el.closeSettings.addEventListener("click", () => el.settingsDialog.close());
el.openNotifications.addEventListener("click", () => {
  renderNotifications();
  el.notificationsDialog.showModal();
  el.notificationDot.hidden = true;
});
el.closeNotifications.addEventListener("click", () => el.notificationsDialog.close());
el.viewButtons.forEach((button) => {
  button.addEventListener("click", () => switchView(button.dataset.view));
});
el.openMenu.addEventListener("click", openMobileMenu);
el.closeMenu.addEventListener("click", closeMobileMenu);
el.drawerBackdrop.addEventListener("click", closeMobileMenu);
el.drawerSettings.addEventListener("click", () => {
  closeMobileMenu();
  el.settingsDialog.showModal();
});
el.includeLabor.addEventListener("change", (event) => setLabor(event.target.checked));
el.laborQty.addEventListener("input", (event) => {
  const labor = laborLine();
  if (!labor) return;
  labor.quantity = Number(event.target.value);
  renderLines();
  renderPreview();
});
el.laborRate.addEventListener("input", (event) => {
  const labor = laborLine();
  if (!labor) return;
  labor.unitPrice = Number(event.target.value);
  renderLines();
  renderPreview();
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
function handleSavedQuoteClick(event) {
  const button = event.target.closest("[data-load-quote]");
  const previewButton = event.target.closest("[data-preview-quote]");
  const deleteButton = event.target.closest("[data-delete-quote]");
  if (previewButton) {
    selectedPreviousQuoteId = selectedPreviousQuoteId === previewButton.dataset.previewQuote ? null : previewButton.dataset.previewQuote;
    renderPreviousQuotes();
    return;
  }
  if (button) {
    const saved = quotes.find((item) => item.id === button.dataset.loadQuote);
    quote = {
      id: saved.id,
      createdAt: saved.createdAt,
      customer: saved.customer,
      project: saved.project,
      quoteNumber: saved.quoteNumber,
      taxRate: saved.taxRate,
      margin: saved.margin,
      terms: saved.terms,
    };
    lines = clone(saved.lines);
    markClean();
    render();
    switchView("quote-view");
  }
  if (deleteButton) deleteQuote(deleteButton.dataset.deleteQuote);
}

el.quoteList.addEventListener("click", handleSavedQuoteClick);
el.previousQuoteList.addEventListener("click", handleSavedQuoteClick);
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
function openBottomTotal() {
  el.bottomTotalToggle.setAttribute("aria-expanded", "true");
  el.bottomTotalDetails.hidden = false;
}

function updateCartQuantity(lineId, value) {
  const quantity = Number(value);
  if (!Number.isFinite(quantity)) return;
  if (quantity <= 0) {
    lines = lines.filter((line) => line.lineId !== lineId);
  } else {
    lines = lines.map((line) => (line.lineId === lineId ? { ...line, quantity } : line));
  }
  syncLaborInputs();
  renderLines();
  renderPreview();
}

function removeCartLine(lineId) {
  lines = lines.filter((line) => line.lineId !== lineId);
  syncLaborInputs();
  renderLines();
  renderPreview();
}

function handleCartInput(event) {
  const input = event.target.closest("[data-cart-qty]");
  if (!input) return;
  updateCartQuantity(input.dataset.cartQty, input.value);
}

function handleCartClick(event) {
  const remove = event.target.closest("[data-cart-remove]");
  if (!remove) return;
  removeCartLine(remove.dataset.cartRemove);
}

function goToFinalize() {
  if (!lines.length) {
    openBottomTotal();
    return;
  }
  el.bottomTotalToggle.setAttribute("aria-expanded", "false");
  el.bottomTotalDetails.hidden = true;
  switchView("finalize-view");
}

el.bottomTotalToggle.addEventListener("click", () => {
  const isOpen = el.bottomTotalToggle.getAttribute("aria-expanded") === "true";
  el.bottomTotalToggle.setAttribute("aria-expanded", String(!isOpen));
  el.bottomTotalDetails.hidden = isOpen;
});
el.mobileFlow.addEventListener("click", (event) => {
  const button = event.target.closest("[data-mobile-step]");
  if (!button) return;
  mobileStep = button.dataset.mobileStep;
  renderMobileStep();
});
el.bottomCartList.addEventListener("change", handleCartInput);
el.bottomCartList.addEventListener("click", handleCartClick);
el.desktopCartList.addEventListener("change", handleCartInput);
el.desktopCartList.addEventListener("click", handleCartClick);
el.finalCartList.addEventListener("change", handleCartInput);
el.finalCartList.addEventListener("click", handleCartClick);
el.bottomNextQuote.addEventListener("click", goToFinalize);
el.desktopNextQuote.addEventListener("click", goToFinalize);
el.headerNextQuote.addEventListener("click", goToFinalize);
el.finalSaveQuote.addEventListener("click", () => lines.length && saveCurrentQuote());
el.finalGeneratePdf.addEventListener("click", emailQuotePdf);
el.finalPrintQuote.addEventListener("click", () => window.print());

render();
hydrate();
