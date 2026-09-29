import type { CatalogItem } from "./types";

const editableCatalogItemFields = [
  "name",
  "sku",
  "category",
  "unitPrice",
  "msrp",
  "inventory",
  "link",
  "notes",
] as const satisfies readonly (keyof CatalogItem)[];

type EditableCatalogItemField = (typeof editableCatalogItemFields)[number];
type CatalogItemEditPatch = Pick<CatalogItem, EditableCatalogItemField>;

const comparableValue = (field: EditableCatalogItemField, value: CatalogItem[EditableCatalogItemField]) => {
  if ((field === "link" || field === "notes") && value === undefined) return "";
  return value;
};

export function applyCatalogItemEdit(item: CatalogItem, patch: Partial<CatalogItemEditPatch>): CatalogItem {
  const editableEntries = editableCatalogItemFields
    .filter((field) => Object.prototype.hasOwnProperty.call(patch, field))
    .map((field) => [field, patch[field]]);
  return { ...item, ...Object.fromEntries(editableEntries) };
}

export function hasCatalogItemEditChanges(item: CatalogItem, draft: CatalogItem): boolean {
  return editableCatalogItemFields.some((field) => comparableValue(field, item[field]) !== comparableValue(field, draft[field]));
}

export function changedCatalogItemEditPatch(item: CatalogItem, draft: CatalogItem): Partial<CatalogItemEditPatch> {
  return Object.fromEntries(
    editableCatalogItemFields
      .filter((field) => comparableValue(field, item[field]) !== comparableValue(field, draft[field]))
      .map((field) => [field, draft[field]]),
  );
}
