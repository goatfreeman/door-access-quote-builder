"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type {
  CatalogItem,
  CompatibilityAttributeDefinition,
  CompatibilityRule,
  CompatibilityRuleStatus,
  ServiceTitanSettings,
} from "@/lib/types";

export function compatibilityAttributeKey(label: string) {
  return label
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function newId(prefix: string) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

function normalizeValues(value: string) {
  return Array.from(new Set(value.split(",").map((entry) => entry.trim()).filter(Boolean)));
}

function ruleTypeLabel(type: CompatibilityRule["type"]) {
  if (type === "attribute-match") return "Attribute match";
  if (type === "prohibited-combination") return "Prohibited combination";
  return "Required companion";
}

function defaultRuleMessage(type: CompatibilityRule["type"]) {
  if (type === "required-companion") return "Add the required companion for {source}.";
  if (type === "prohibited-combination") return "{source} and {target} are a prohibited combination.";
  return "{source} uses {sourceValue}; {target} uses {targetValue}.";
}

function selectorWithoutAttribute(selector: CompatibilityRule["source"]) {
  return {
    ...(selector.itemId ? { itemId: selector.itemId } : {}),
    ...(selector.category ? { category: selector.category } : {}),
  };
}

export function ruleTypePatch(rule: CompatibilityRule, type: CompatibilityRule["type"], defaultAttributeKey = ""): Partial<CompatibilityRule> {
  if (type === "attribute-match") {
    return {
      type,
      source: selectorWithoutAttribute(rule.source),
      target: selectorWithoutAttribute(rule.target),
      attributeKey: rule.attributeKey || defaultAttributeKey,
      message: defaultRuleMessage(type),
    };
  }
  return { type, message: defaultRuleMessage(type) };
}

export function CompatibilitySettingsPanel({
  settings,
  setSettings,
  items,
  categories,
}: {
  settings: ServiceTitanSettings;
  setSettings: Dispatch<SetStateAction<ServiceTitanSettings>>;
  items: CatalogItem[];
  categories: string[];
}) {
  const attributes = settings.compatibilityAttributes ?? [];
  const rules = settings.compatibilityRules ?? [];
  const activeItems = useMemo(() => items.filter((item) => !item.deletedAt).sort((a, b) => a.name.localeCompare(b.name)), [items]);
  const [selectedItemId, setSelectedItemId] = useState(activeItems[0]?.id ?? "");
  const [attributeDraft, setAttributeDraft] = useState({ label: "", values: "" });
  const selectedItem = activeItems.find((item) => item.id === selectedItemId) ?? activeItems[0];

  const addAttribute = () => {
    const label = attributeDraft.label.trim();
    const key = compatibilityAttributeKey(label);
    if (!label || !key || attributes.some((attribute) => attribute.key === key)) return;
    const definition: CompatibilityAttributeDefinition = {
      id: newId("attribute"),
      key,
      label,
      allowedValues: normalizeValues(attributeDraft.values),
    };
    setSettings((current) => ({
      ...current,
      compatibilityAttributes: [...(current.compatibilityAttributes ?? []), definition],
    }));
    setAttributeDraft({ label: "", values: "" });
  };

  const removeAttribute = (key: string) => {
    setSettings((current) => {
      const itemAttributes = Object.fromEntries(
        Object.entries(current.compatibilityItemAttributes ?? {}).map(([itemId, values]) => [
          itemId,
          Object.fromEntries(Object.entries(values).filter(([attributeKey]) => attributeKey !== key)),
        ]),
      );
      return {
        ...current,
        compatibilityAttributes: (current.compatibilityAttributes ?? []).filter((attribute) => attribute.key !== key),
        compatibilityItemAttributes: itemAttributes,
        compatibilityRules: (current.compatibilityRules ?? []).map((rule) => rule.attributeKey === key || rule.source.attributeKey === key || rule.target.attributeKey === key ? { ...rule, enabled: false, revision: rule.revision + 1 } : rule),
      };
    });
  };

  const setItemAttribute = (itemId: string, key: string, value: string) => {
    setSettings((current) => ({
      ...current,
      compatibilityItemAttributes: {
        ...(current.compatibilityItemAttributes ?? {}),
        [itemId]: {
          ...(current.compatibilityItemAttributes?.[itemId] ?? {}),
          [key]: value,
        },
      },
    }));
  };

  const addRule = () => {
    const firstAttribute = attributes[0]?.key ?? "";
    const firstCategory = categories[0] ?? "";
    const rule: CompatibilityRule = {
      id: newId("rule"),
      name: "New compatibility rule",
      enabled: true,
      type: "attribute-match",
      source: { category: firstCategory },
      target: { category: categories[1] ?? firstCategory },
      attributeKey: firstAttribute,
      status: "CONFLICT",
      message: defaultRuleMessage("attribute-match"),
      revision: 1,
    };
    setSettings((current) => ({ ...current, compatibilityRules: [...(current.compatibilityRules ?? []), rule] }));
  };

  const updateRule = (ruleId: string, patch: Partial<CompatibilityRule>) => {
    setSettings((current) => ({
      ...current,
      compatibilityRules: (current.compatibilityRules ?? []).map((rule) => rule.id === ruleId ? { ...rule, ...patch, revision: rule.revision + 1 } : rule),
    }));
  };

  const removeRule = (ruleId: string) => {
    setSettings((current) => ({
      ...current,
      compatibilityRules: (current.compatibilityRules ?? []).filter((rule) => rule.id !== ruleId),
    }));
  };

  return (
    <section className="grid gap-4" aria-label="Deterministic compatibility rules">
      <div className="rounded-lg border border-teal-200 bg-teal-50 p-4">
        <h3 className="font-black text-teal-950">Deterministic compatibility rules</h3>
        <p className="mt-1 text-sm text-teal-900">Set catalog attributes and quote rules for immediate warnings. No AI request is used for these checks.</p>
      </div>

      <section className="rounded-lg border border-stone-200 bg-stone-50 p-4">
        <h4 className="font-black">1. Attribute definitions</h4>
        <p className="mt-1 text-sm text-stone-600">Create reusable technical fields. Separate allowed values with commas.</p>
        <div className="mt-4 grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <input className="input" value={attributeDraft.label} onChange={(event) => setAttributeDraft((current) => ({ ...current, label: event.target.value }))} placeholder="Attribute label, for example Fiber mode" />
          <input className="input" value={attributeDraft.values} onChange={(event) => setAttributeDraft((current) => ({ ...current, values: event.target.value }))} placeholder="singlemode, multimode" />
          <button className="button-secondary" onClick={addAttribute}><Plus size={16} />Add attribute</button>
        </div>
        <div className="mt-3 grid gap-2">
          {attributes.map((attribute) => (
            <div key={attribute.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-stone-200 bg-white p-3">
              <div>
                <p className="font-black">{attribute.label}</p>
                <p className="font-mono text-xs text-stone-500">{attribute.key}</p>
                <p className="mt-1 text-sm text-stone-600">{attribute.allowedValues.join(", ") || "Free text"}</p>
              </div>
              <button className="button-ghost text-red-800" onClick={() => removeAttribute(attribute.key)} aria-label={`Remove ${attribute.label}`}><Trash2 size={16} />Remove</button>
            </div>
          ))}
          {!attributes.length ? <p className="rounded-md border border-dashed border-stone-300 bg-white p-4 text-center text-sm text-stone-500">No compatibility attributes yet.</p> : null}
        </div>
      </section>

      <section className="rounded-lg border border-stone-200 bg-stone-50 p-4">
        <h4 className="font-black">2. Catalog item values</h4>
        <p className="mt-1 text-sm text-stone-600">Assign technical values to each item. Rules compare these controlled values.</p>
        <select className="input mt-4" value={selectedItem?.id ?? ""} onChange={(event) => setSelectedItemId(event.target.value)}>
          {!activeItems.length ? <option value="">No catalog items</option> : null}
          {activeItems.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.sku}</option>)}
        </select>
        {selectedItem ? (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {attributes.map((attribute) => {
              const value = settings.compatibilityItemAttributes?.[selectedItem.id]?.[attribute.key] ?? "";
              return (
                <label key={attribute.id} className="field">
                  <span>{attribute.label}</span>
                  {attribute.allowedValues.length ? (
                    <select className="input" value={value} onChange={(event) => setItemAttribute(selectedItem.id, attribute.key, event.target.value)}>
                      <option value="">Not set</option>
                      {attribute.allowedValues.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  ) : (
                    <input className="input" value={value} onChange={(event) => setItemAttribute(selectedItem.id, attribute.key, event.target.value)} placeholder="Not set" />
                  )}
                </label>
              );
            })}
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-stone-200 bg-stone-50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="font-black">3. Rules</h4>
            <p className="mt-1 text-sm text-stone-600">Rules run automatically whenever quote equipment changes.</p>
          </div>
          <button className="button-secondary" onClick={addRule} disabled={!attributes.length || !categories.length}><Plus size={16} />Add rule</button>
        </div>
        <div className="mt-4 grid gap-3">
          {rules.map((rule) => (
            <article key={rule.id} className="grid gap-3 rounded-lg border border-stone-200 bg-white p-4">
              <div className="grid gap-2 md:grid-cols-[auto_minmax(0,1fr)_200px_auto]">
                <label className="inline-flex items-center gap-2 text-sm font-black"><input type="checkbox" checked={rule.enabled} onChange={(event) => updateRule(rule.id, { enabled: event.target.checked })} />Enabled</label>
                <input className="input" value={rule.name} onChange={(event) => updateRule(rule.id, { name: event.target.value })} aria-label="Rule name" />
                <select className="input" value={rule.type} onChange={(event) => updateRule(rule.id, ruleTypePatch(rule, event.target.value as CompatibilityRule["type"], attributes[0]?.key))} aria-label="Rule type">
                  <option value="attribute-match">Attribute match</option>
                  <option value="prohibited-combination">Prohibited combination</option>
                  <option value="required-companion">Required companion</option>
                </select>
                <button className="icon-button text-red-800" onClick={() => removeRule(rule.id)} aria-label={`Remove ${rule.name}`}><Trash2 size={16} /></button>
              </div>
              <p className="text-xs font-black uppercase tracking-wide text-stone-500">{ruleTypeLabel(rule.type)} · Revision {rule.revision}</p>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <label className="field"><span>Source category</span><select className="input" value={rule.source.category ?? ""} onChange={(event) => updateRule(rule.id, { source: { ...rule.source, category: event.target.value } })}>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
                <label className="field"><span>Source item override</span><select className="input" value={rule.source.itemId ?? ""} onChange={(event) => updateRule(rule.id, { source: { ...rule.source, itemId: event.target.value || undefined } })}><option value="">Any item in category</option>{activeItems.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.sku}</option>)}</select></label>
                <label className="field"><span>Related category</span><select className="input" value={rule.target.category ?? ""} onChange={(event) => updateRule(rule.id, { target: { ...rule.target, category: event.target.value } })}>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
                <label className="field"><span>Related item override</span><select className="input" value={rule.target.itemId ?? ""} onChange={(event) => updateRule(rule.id, { target: { ...rule.target, itemId: event.target.value || undefined } })}><option value="">Any item in category</option>{activeItems.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.sku}</option>)}</select></label>
              </div>
              {rule.type === "attribute-match" ? (
                <label className="field"><span>Attribute that must match</span><select className="input" value={rule.attributeKey ?? ""} onChange={(event) => updateRule(rule.id, { attributeKey: event.target.value })}><option value="">Select attribute</option>{attributes.map((attribute) => <option key={attribute.key} value={attribute.key}>{attribute.label}</option>)}</select></label>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  <SelectorAttributeFields prefix="Source" attributes={attributes} selector={rule.source} onChange={(source) => updateRule(rule.id, { source })} />
                  <SelectorAttributeFields prefix="Related" attributes={attributes} selector={rule.target} onChange={(target) => updateRule(rule.id, { target })} />
                </div>
              )}
              <div className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
                <label className="field"><span>Warning status</span><select className="input" value={rule.status} onChange={(event) => updateRule(rule.id, { status: event.target.value as CompatibilityRuleStatus })}><option value="CONFLICT">CONFLICT</option><option value="OPEN">OPEN</option><option value="BLOCKED">BLOCKED</option></select></label>
                <label className="field"><span>Warning message</span><input className="input" value={rule.message} onChange={(event) => updateRule(rule.id, { message: event.target.value })} /></label>
              </div>
              <p className="text-xs text-stone-500">Message fields: {rule.type === "required-companion" ? "{source}." : rule.type === "prohibited-combination" ? "{source}, {target}." : "{source}, {target}, {sourceValue}, {targetValue}, {attribute}."}</p>
            </article>
          ))}
          {!rules.length ? <p className="rounded-md border border-dashed border-stone-300 bg-white p-4 text-center text-sm text-stone-500">No deterministic rules yet.</p> : null}
        </div>
      </section>
    </section>
  );
}

function SelectorAttributeFields({
  prefix,
  attributes,
  selector,
  onChange,
}: {
  prefix: string;
  attributes: CompatibilityAttributeDefinition[];
  selector: { itemId?: string; category?: string; attributeKey?: string; attributeValue?: string };
  onChange: (selector: { itemId?: string; category?: string; attributeKey?: string; attributeValue?: string }) => void;
}) {
  const definition = attributes.find((attribute) => attribute.key === selector.attributeKey);
  return (
    <div className="grid gap-2 rounded-md border border-stone-200 bg-stone-50 p-3">
      <label className="field"><span>{prefix} attribute</span><select className="input" value={selector.attributeKey ?? ""} onChange={(event) => onChange({ ...selector, attributeKey: event.target.value, attributeValue: "" })}><option value="">No attribute filter</option>{attributes.map((attribute) => <option key={attribute.key} value={attribute.key}>{attribute.label}</option>)}</select></label>
      {selector.attributeKey ? <label className="field"><span>{prefix} value</span>{definition?.allowedValues.length ? <select className="input" value={selector.attributeValue ?? ""} onChange={(event) => onChange({ ...selector, attributeValue: event.target.value })}><option value="">Any configured value</option>{definition.allowedValues.map((value) => <option key={value} value={value}>{value}</option>)}</select> : <input className="input" value={selector.attributeValue ?? ""} onChange={(event) => onChange({ ...selector, attributeValue: event.target.value })} />}</label> : null}
    </div>
  );
}
