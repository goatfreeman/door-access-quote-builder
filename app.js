const catalog = [
  {
    id: "axis-p3265",
    name: "Axis P3265-LVE Dome Camera",
    category: "Cameras",
    description: "Outdoor-ready network dome camera for entry and lobby coverage.",
    unitPrice: 879,
  },
  {
    id: "axis-m3085",
    name: "Axis M3085-V Compact Dome",
    category: "Cameras",
    description: "Low-profile indoor camera for vestibules, corridors, and reception.",
    unitPrice: 479,
  },
  {
    id: "axis-camera-license",
    name: "Camera Recording License",
    category: "Cameras",
    description: "VMS or cloud recording license placeholder per camera.",
    unitPrice: 165,
  },
  {
    id: "honeywell-netaxs",
    name: "Honeywell NetAXS-123 Panel",
    category: "Access Panels",
    description: "Door access controller with enclosure and power supply allowance.",
    unitPrice: 1295,
  },
  {
    id: "honeywell-reader",
    name: "Honeywell Proximity Reader",
    category: "Access Panels",
    description: "Wall-mounted card reader for single controlled opening.",
    unitPrice: 245,
  },
  {
    id: "cards",
    name: "Proximity Cards",
    category: "Access Panels",
    description: "Credential cards for employees or tenants.",
    unitPrice: 7.5,
  },
  {
    id: "assa-9600",
    name: "ASSA ABLOY 9600 Electric Strike",
    category: "Door Hardware",
    description: "Heavy-duty electric strike for cylindrical or mortise locksets.",
    unitPrice: 398,
  },
  {
    id: "rex-button",
    name: "Request-to-Exit Button",
    category: "Door Hardware",
    description: "Exit control device for egress side of controlled door.",
    unitPrice: 86,
  },
  {
    id: "door-contact",
    name: "Door Position Contact",
    category: "Door Hardware",
    description: "Monitored contact for forced-open and held-open reporting.",
    unitPrice: 48,
  },
  {
    id: "install-labor",
    name: "Installation Labor",
    category: "Labor",
    description: "Technician labor for mounting, wiring, trim-out, and testing.",
    unitPrice: 115,
  },
  {
    id: "programming",
    name: "Programming and Commissioning",
    category: "Labor",
    description: "System setup, schedules, cardholder configuration, and owner handoff.",
    unitPrice: 145,
  },
];

const categories = ["All", "Cameras", "Access Panels", "Door Hardware", "Labor"];
const storageKey = "door-access-quote-templates";
const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

let selectedCategory = "All";
let searchQuery = "";
let lines = [
  freshLine(catalog.find((item) => item.id === "honeywell-netaxs")),
  freshLine(catalog.find((item) => item.id === "honeywell-reader")),
  freshLine(catalog.find((item) => item.id === "assa-9600")),
  freshLine(catalog.find((item) => item.id === "install-labor")),
];
let templates = loadTemplates();
let quoteInfo = {
  customer: "Customer Name",
  project: "Main entrance access control",
  quoteNumber: "Q-1001",
  taxRate: 8.25,
  margin: 20,
  terms:
    "Includes standard installation during normal business hours. Final pricing subject to site survey, cable pathways, door condition, and authority requirements.",
};

const els = {
  search: document.querySelector("#search"),
  categoryTabs: document.querySelector("#category-tabs"),
  catalogList: document.querySelector("#catalog-list"),
  quoteLines: document.querySelector("#quote-lines"),
  customer: document.querySelector("#customer"),
  quoteNumber: document.querySelector("#quote-number"),
  project: document.querySelector("#project"),
  margin: document.querySelector("#margin"),
  tax: document.querySelector("#tax"),
  terms: document.querySelector("#terms"),
  subtotal: document.querySelector("#subtotal"),
  marginAmount: document.querySelector("#margin-amount"),
  taxAmount: document.querySelector("#tax-amount"),
  total: document.querySelector("#total"),
  templateName: document.querySelector("#template-name"),
  templateList: document.querySelector("#template-list"),
  previewProject: document.querySelector("#preview-project"),
  previewCustomer: document.querySelector("#preview-customer"),
  previewQuote: document.querySelector("#preview-quote"),
  previewLines: document.querySelector("#preview-lines"),
  previewTerms: document.querySelector("#preview-terms"),
  saveTemplate: document.querySelector("#save-template"),
  copySummary: document.querySelector("#copy-summary"),
  printQuote: document.querySelector("#print-quote"),
};

function freshLine(item) {
  return {
    ...item,
    lineId: crypto.randomUUID(),
    quantity: item.category === "Labor" ? 4 : 1,
    notes: item.description,
  };
}

function cloneLines(items) {
  return items.map((item) => ({ ...item, lineId: crypto.randomUUID() }));
}

function loadTemplates() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || [];
  } catch {
    localStorage.removeItem(storageKey);
    return [];
  }
}

function saveTemplates() {
  localStorage.setItem(storageKey, JSON.stringify(templates));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderCategories() {
  els.categoryTabs.innerHTML = categories
    .map(
      (category) =>
        `<button class="tab-button ${category === selectedCategory ? "active" : ""}" type="button" data-category="${category}">${category}</button>`,
    )
    .join("");
}

function renderCatalog() {
  const query = searchQuery.trim().toLowerCase();
  const filtered = catalog.filter((item) => {
    const matchesCategory = selectedCategory === "All" || item.category === selectedCategory;
    const haystack = `${item.name} ${item.description} ${item.category}`.toLowerCase();
    return matchesCategory && (!query || haystack.includes(query));
  });

  els.catalogList.innerHTML = filtered
    .map(
      (item) => `
        <article class="catalog-item">
          <div class="item-main">
            <div>
              <h3>${escapeHtml(item.name)}</h3>
              <p>${escapeHtml(item.description)}</p>
            </div>
            <span class="price">${currency.format(item.unitPrice)}</span>
          </div>
          <button class="button secondary" type="button" data-add="${item.id}">
            <span aria-hidden="true">+</span> Add item
          </button>
        </article>
      `,
    )
    .join("");
}

function renderQuoteLines() {
  if (lines.length === 0) {
    els.quoteLines.innerHTML = '<div class="empty-state"><div>Add catalog items to start a quote.</div></div>';
    return;
  }

  els.quoteLines.innerHTML = `
    <div class="quote-table">
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Unit</th>
            <th>Notes</th>
            <th>Total</th>
            <th aria-label="Actions"></th>
          </tr>
        </thead>
        <tbody>
          ${lines
            .map(
              (line) => `
                <tr>
                  <td class="cell-name">
                    <input class="input" data-line="${line.lineId}" data-field="name" value="${escapeHtml(line.name)}" aria-label="Line item name" />
                  </td>
                  <td>
                    <input class="input number-input" type="number" min="0" step="1" data-line="${line.lineId}" data-field="quantity" value="${line.quantity}" aria-label="Quantity" />
                  </td>
                  <td>
                    <input class="input money-input" type="number" min="0" step="0.01" data-line="${line.lineId}" data-field="unitPrice" value="${line.unitPrice}" aria-label="Unit price" />
                  </td>
                  <td class="cell-notes">
                    <textarea class="textarea" data-line="${line.lineId}" data-field="notes" aria-label="Line notes">${escapeHtml(line.notes)}</textarea>
                  </td>
                  <td class="line-total">${currency.format(line.quantity * line.unitPrice)}</td>
                  <td>
                    <button class="button ghost icon" type="button" title="Remove line" aria-label="Remove line" data-remove="${line.lineId}">x</button>
                  </td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderTotalsAndPreview() {
  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const marginAmount = subtotal * (quoteInfo.margin / 100);
  const taxable = subtotal + marginAmount;
  const taxAmount = taxable * (quoteInfo.taxRate / 100);
  const total = taxable + taxAmount;

  els.subtotal.textContent = currency.format(subtotal);
  els.marginAmount.textContent = currency.format(marginAmount);
  els.taxAmount.textContent = currency.format(taxAmount);
  els.total.textContent = currency.format(total);
  els.previewProject.textContent = quoteInfo.project;
  els.previewCustomer.textContent = quoteInfo.customer;
  els.previewQuote.textContent = quoteInfo.quoteNumber;
  els.previewTerms.textContent = quoteInfo.terms;
  els.previewLines.innerHTML = lines
    .map(
      (line) => `
        <div class="preview-line">
          <div>
            <h4>${line.quantity} x ${escapeHtml(line.name)}</h4>
            <p>${escapeHtml(line.notes)}</p>
          </div>
          <strong>${currency.format(line.quantity * line.unitPrice)}</strong>
        </div>
      `,
    )
    .join("");
}

function renderTemplates() {
  els.templateList.innerHTML = templates
    .map(
      (template) => `
        <article class="template-item">
          <div class="item-main">
            <div>
              <h3>${escapeHtml(template.name)}</h3>
              <p>${template.lines.length} quote lines</p>
            </div>
          </div>
          <div class="top-actions">
            <button class="button secondary" type="button" data-load-template="${template.id}">Load</button>
            <button class="button ghost icon" type="button" title="Delete template" aria-label="Delete template" data-delete-template="${template.id}">x</button>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderInputs() {
  els.customer.value = quoteInfo.customer;
  els.quoteNumber.value = quoteInfo.quoteNumber;
  els.project.value = quoteInfo.project;
  els.margin.value = quoteInfo.margin;
  els.tax.value = quoteInfo.taxRate;
  els.terms.value = quoteInfo.terms;
  els.templateName.value ||= "Single door access package";
}

function render() {
  renderCategories();
  renderCatalog();
  renderInputs();
  renderQuoteLines();
  renderTotalsAndPreview();
  renderTemplates();
}

function updateQuoteInfo(key, value) {
  quoteInfo = { ...quoteInfo, [key]: value };
  renderTotalsAndPreview();
}

els.search.addEventListener("input", (event) => {
  searchQuery = event.target.value;
  renderCatalog();
});

els.categoryTabs.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  selectedCategory = button.dataset.category;
  renderCategories();
  renderCatalog();
});

els.catalogList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-add]");
  if (!button) return;
  const item = catalog.find((candidate) => candidate.id === button.dataset.add);
  lines = [...lines, freshLine(item)];
  renderQuoteLines();
  renderTotalsAndPreview();
});

els.quoteLines.addEventListener("input", (event) => {
  const input = event.target.closest("[data-line]");
  if (!input) return;
  const field = input.dataset.field;
  let updatedLine = null;
  lines = lines.map((line) => {
    if (line.lineId !== input.dataset.line) return line;
    const value = field === "quantity" || field === "unitPrice" ? Number(input.value) : input.value;
    updatedLine = { ...line, [field]: value };
    return updatedLine;
  });
  if (updatedLine) {
    const rowTotal = event.target.closest("tr")?.querySelector(".line-total");
    if (rowTotal) rowTotal.textContent = currency.format(updatedLine.quantity * updatedLine.unitPrice);
  }
  renderTotalsAndPreview();
});

els.quoteLines.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove]");
  if (!button) return;
  lines = lines.filter((line) => line.lineId !== button.dataset.remove);
  renderQuoteLines();
  renderTotalsAndPreview();
});

els.customer.addEventListener("input", (event) => updateQuoteInfo("customer", event.target.value));
els.quoteNumber.addEventListener("input", (event) => updateQuoteInfo("quoteNumber", event.target.value));
els.project.addEventListener("input", (event) => updateQuoteInfo("project", event.target.value));
els.margin.addEventListener("input", (event) => updateQuoteInfo("margin", Number(event.target.value)));
els.tax.addEventListener("input", (event) => updateQuoteInfo("taxRate", Number(event.target.value)));
els.terms.addEventListener("input", (event) => updateQuoteInfo("terms", event.target.value));

els.saveTemplate.addEventListener("click", () => {
  const name = els.templateName.value.trim();
  if (!name || lines.length === 0) return;
  templates = [{ id: crypto.randomUUID(), name, lines: cloneLines(lines) }, ...templates];
  saveTemplates();
  renderTemplates();
});

els.templateList.addEventListener("click", (event) => {
  const loadButton = event.target.closest("[data-load-template]");
  const deleteButton = event.target.closest("[data-delete-template]");

  if (loadButton) {
    const template = templates.find((candidate) => candidate.id === loadButton.dataset.loadTemplate);
    lines = cloneLines(template.lines);
    els.templateName.value = template.name;
    renderQuoteLines();
    renderTotalsAndPreview();
  }

  if (deleteButton) {
    templates = templates.filter((template) => template.id !== deleteButton.dataset.deleteTemplate);
    saveTemplates();
    renderTemplates();
  }
});

els.copySummary.addEventListener("click", async () => {
  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const marginAmount = subtotal * (quoteInfo.margin / 100);
  const taxable = subtotal + marginAmount;
  const taxAmount = taxable * (quoteInfo.taxRate / 100);
  const total = taxable + taxAmount;
  const summary = [
    `${quoteInfo.quoteNumber} - ${quoteInfo.project}`,
    `Customer: ${quoteInfo.customer}`,
    "",
    ...lines.map(
      (line) =>
        `${line.quantity} x ${line.name} @ ${currency.format(line.unitPrice)} = ${currency.format(
          line.quantity * line.unitPrice,
        )}`,
    ),
    "",
    `Subtotal: ${currency.format(subtotal)}`,
    `Margin: ${currency.format(marginAmount)}`,
    `Tax: ${currency.format(taxAmount)}`,
    `Total: ${currency.format(total)}`,
  ].join("\n");

  await navigator.clipboard.writeText(summary);
});

els.printQuote.addEventListener("click", () => window.print());

render();
