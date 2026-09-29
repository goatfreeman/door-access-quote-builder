import type { CatalogItem } from "../types";
import type { CompatibilityResult, EvidenceStatus } from "./domain";
import { normalizeCompatibilityRequest } from "./domain";

const statusPriority: Record<EvidenceStatus, number> = {
  BLOCKED: 6,
  CONFLICT: 5,
  OPEN: 4,
  ASSUMED: 3,
  CONFIRMED: 2,
  "NOT APPLICABLE": 1,
};

export function resolveCatalogItemVerification(selectedItemId: string, quoteItemIds: string[], catalog: CatalogItem[]) {
  const selectedItem = catalog.find((item) => item.id === selectedItemId && !item.deletedAt);
  if (!selectedItem) throw new Error("Catalog item was not found");
  const catalogById = new Map(catalog.map((item) => [item.id, item]));
  const quoteItems: CatalogItem[] = [];
  const unresolvedItems: string[] = [];
  let unknownItemCount = 0;
  let blankSkuCount = 0;
  for (const id of Array.from(new Set(quoteItemIds))) {
    if (id === selectedItemId) continue;
    const item = catalogById.get(id);
    if (!item) {
      unknownItemCount += 1;
      unresolvedItems.push(`Unresolved quote item ${unknownItemCount}`);
    } else if (item.deletedAt) {
      unresolvedItems.push(`${item.sku.trim() || "Unknown SKU"} (deleted catalog item)`);
    } else if (!item.sku.trim()) {
      blankSkuCount += 1;
      unresolvedItems.push(`Catalog item with blank SKU ${blankSkuCount}`);
    } else {
      quoteItems.push(item);
    }
  }
  let reviewItem = selectedItem;
  if (!selectedItem.sku.trim()) {
    unresolvedItems.unshift("Selected catalog item with blank SKU");
    const controlledItem = quoteItems.shift();
    if (!controlledItem) throw new Error("No catalog item with a controlled SKU was found");
    reviewItem = controlledItem;
  }
  const uniqueItems = uniqueRelatedItems(reviewItem, quoteItems);
  return {
    request: buildItemVerificationRequest(reviewItem, uniqueItems.slice(0, 25)),
    omittedItems: [...uniqueItems.slice(25).map((item) => item.sku.trim()), ...unresolvedItems],
  };
}

export function buildItemVerificationRequest(selectedItem: CatalogItem, quoteItems: CatalogItem[]) {
  const relatedItems = uniqueRelatedItems(selectedItem, quoteItems).map((item) => item.sku.trim()).slice(0, 25);

  return normalizeCompatibilityRequest({
    manufacturer: selectedItem.vendor?.trim() || "OPEN",
    sourcePartNumber: selectedItem.sku,
    description: `${selectedItem.name}; category: ${selectedItem.category}`,
    relatedItems,
    question: [
      "Identify all required companion parts and accessories for this item.",
      "Verify compatibility with every related quote item.",
      "Identify required companion parts for each related quote item and check the interfaces between related items.",
      "For fiber equipment, explicitly verify fiber mode (singlemode or multimode), connector type, wavelength, data rate, and the required fiber patch cable or transceiver.",
      "Also check power, licenses, mounts, modules, and environmental accessories.",
      "Do not assume that items are compatible when current manufacturer evidence is missing.",
    ].join(" "),
  });
}

export function markIncompleteCoverage(result: CompatibilityResult, omittedItems: string[]): CompatibilityResult {
  if (!omittedItems.length) return result;
  const reports = result.reports.map((report) => report.role !== "tester" ? report : {
    ...report,
    status: moreConservativeStatus(report.status, "OPEN"),
    findings: [...report.findings, {
      title: "Incomplete quote-item coverage",
      detail: `${omittedItems.length} quote item(s) were omitted from the controlled compatibility review. The reason can be a review limit, a missing catalog record, a deleted record, or a missing controlled SKU.`,
      status: "OPEN" as const,
      affectedItems: omittedItems,
      evidence: [],
      recommendedAction: "Run additional controlled reviews for the omitted product identifiers before approval.",
    }],
  });
  return {
    ...result,
    reports,
    finalStatus: moreConservativeStatus(result.finalStatus, "OPEN"),
  };
}

function uniqueRelatedItems(selectedItem: CatalogItem, quoteItems: CatalogItem[]) {
  const selectedSku = selectedItem.sku.trim().toUpperCase();
  const seen = new Set<string>();
  return quoteItems.filter((item) => {
    const sku = item.sku.trim().toUpperCase();
    if (!sku || sku === selectedSku || seen.has(sku)) return false;
    seen.add(sku);
    return true;
  });
}

function moreConservativeStatus(left: EvidenceStatus, right: EvidenceStatus): EvidenceStatus {
  return statusPriority[left] >= statusPriority[right] ? left : right;
}