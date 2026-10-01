import type {
  CatalogItem,
  CompatibilityItemSelector,
  CompatibilityRule,
  CompatibilityRuleStatus,
  QuoteLine,
} from "./types";

export type DeterministicCompatibilityFinding = {
  id: string;
  ruleId: string;
  ruleRevision: number;
  status: CompatibilityRuleStatus | "CONFIRMED" | "NOT APPLICABLE";
  title: string;
  message: string;
  itemIds: string[];
};

type EvaluationInput = {
  lines: QuoteLine[];
  items: CatalogItem[];
  attributesByItem?: Record<string, Record<string, string>>;
  rules?: CompatibilityRule[];
};

type QuoteItem = {
  item: CatalogItem;
  attributes: Record<string, string>;
};

function normalized(value: unknown) {
  return typeof value === "string" ? value.trim().toLocaleLowerCase() : "";
}

function attributeValue(candidate: QuoteItem, key: string) {
  if (!Object.prototype.hasOwnProperty.call(candidate.attributes, key)) return undefined;
  const value = candidate.attributes[key];
  return typeof value === "string" ? value : undefined;
}

function selectorMatches(candidate: QuoteItem, selector: CompatibilityItemSelector) {
  if (!selectorBaseMatches(candidate, selector)) return false;
  if (selector.attributeKey) {
    const actual = attributeValue(candidate, selector.attributeKey);
    if (!normalized(actual)) return false;
    if (selector.attributeValue && normalized(actual) !== normalized(selector.attributeValue)) return false;
  }
  return true;
}

function selectorBaseMatches(candidate: QuoteItem, selector: CompatibilityItemSelector) {
  if (selector.itemId) return candidate.item.id === selector.itemId;
  if (selector.category && normalized(candidate.item.category) !== normalized(selector.category)) return false;
  return true;
}

function missingSelectorAttribute(candidate: QuoteItem, selector: CompatibilityItemSelector) {
  return Boolean(selector.attributeKey && !normalized(attributeValue(candidate, selector.attributeKey)));
}

function renderMessage(template: string, values: Record<string, string>) {
  return template.replace(/\{([^{}]+)\}/g, (placeholder, key: string) => (
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : placeholder
  ));
}

function pairId(ruleId: string, itemIds: string[], directional: boolean) {
  return `${ruleId}:${directional ? itemIds.join("->") : [...itemIds].sort().join(":")}`;
}

function finding(
  rule: CompatibilityRule,
  status: DeterministicCompatibilityFinding["status"],
  message: string,
  itemIds: string[],
  directional = false,
): DeterministicCompatibilityFinding {
  return {
    id: pairId(rule.id, itemIds, directional),
    ruleId: rule.id,
    ruleRevision: rule.revision,
    status,
    title: rule.name,
    message,
    itemIds,
  };
}

export function evaluateCompatibilityRules({
  lines,
  items,
  attributesByItem = {},
  rules = [],
}: EvaluationInput): DeterministicCompatibilityFinding[] {
  const itemById = new Map(items.filter((item) => !item.deletedAt).map((item) => [item.id, item]));
  const quoteItems = Array.from(new Set(lines.map((line) => line.itemId)))
    .map((itemId) => itemById.get(itemId))
    .filter((item): item is CatalogItem => Boolean(item))
    .map((item) => ({ item, attributes: attributesByItem[item.id] ?? {} }));
  const findings = new Map<string, DeterministicCompatibilityFinding>();

  rules.filter((rule) => rule.enabled).forEach((rule) => {
    const baseSources = quoteItems.filter((candidate) => selectorBaseMatches(candidate, rule.source));
    baseSources.filter((candidate) => missingSelectorAttribute(candidate, rule.source)).forEach((source) => {
      const result = finding(rule, "OPEN", `${rule.name} needs ${rule.source.attributeKey} for ${source.item.name}.`, [source.item.id]);
      findings.set(result.id, result);
    });
    const sources = quoteItems.filter((candidate) => selectorMatches(candidate, rule.source));
    if (!sources.length) return;

    const baseTargets = quoteItems.filter((candidate) => selectorBaseMatches(candidate, rule.target));
    const missingTargets = baseTargets.filter((candidate) => missingSelectorAttribute(candidate, rule.target));

    if (rule.type === "required-companion") {
      sources.forEach((source) => {
        const companion = quoteItems.find((target) => target.item.id !== source.item.id && selectorMatches(target, rule.target));
        const eligibleMissingTargets = missingTargets.filter((target) => target.item.id !== source.item.id);
        if (!companion && eligibleMissingTargets.length) {
          eligibleMissingTargets.forEach((target) => {
            const result = finding(rule, "OPEN", `${rule.name} needs ${rule.target.attributeKey} for ${target.item.name}.`, [source.item.id, target.item.id], true);
            findings.set(result.id, result);
          });
          return;
        }
        const message = companion
          ? `${rule.name} passed for ${source.item.name}.`
          : renderMessage(rule.message, { source: source.item.name });
        const result = finding(rule, companion ? "CONFIRMED" : rule.status, message, companion ? [source.item.id, companion.item.id] : [source.item.id], true);
        findings.set(result.id, result);
      });
      return;
    }

    sources.forEach((source) => {
      missingTargets.filter((target) => target.item.id !== source.item.id).forEach((target) => {
        const result = finding(rule, "OPEN", `${rule.name} needs ${rule.target.attributeKey} for ${target.item.name}.`, [source.item.id, target.item.id]);
        findings.set(result.id, result);
      });
    });
    const targets = quoteItems.filter((candidate) => selectorMatches(candidate, rule.target));
    sources.forEach((source) => {
      targets.forEach((target) => {
        if (target.item.id === source.item.id) return;

        if (rule.type === "prohibited-combination") {
          const message = renderMessage(rule.message, {
            source: source.item.name,
            target: target.item.name,
          });
          const result = finding(rule, rule.status, message, [source.item.id, target.item.id]);
          findings.set(result.id, result);
          return;
        }

        const key = rule.attributeKey?.trim();
        if (!key) {
          const result = finding(rule, "OPEN", `${rule.name} needs a comparison attribute.`, [source.item.id, target.item.id]);
          findings.set(result.id, result);
          return;
        }
        const sourceValue = attributeValue(source, key);
        const targetValue = attributeValue(target, key);
        if (!sourceValue?.trim() || !targetValue?.trim()) {
          const missingItems = [!sourceValue?.trim() ? source.item.name : "", !targetValue?.trim() ? target.item.name : ""].filter(Boolean).join(" and ");
          const result = finding(
            rule,
            "OPEN",
            `${rule.name} needs ${key} for ${missingItems}.`,
            [source.item.id, target.item.id],
          );
          findings.set(result.id, result);
          return;
        }
        if (normalized(sourceValue) === normalized(targetValue)) {
          const result = finding(
            rule,
            "CONFIRMED",
            `${rule.name} passed for ${source.item.name} and ${target.item.name}.`,
            [source.item.id, target.item.id],
          );
          findings.set(result.id, result);
          return;
        }
        const message = renderMessage(rule.message, {
          source: source.item.name,
          target: target.item.name,
          attribute: key,
          sourceValue,
          targetValue,
        });
        const result = finding(rule, rule.status, message, [source.item.id, target.item.id]);
        findings.set(result.id, result);
      });
    });
  });

  return Array.from(findings.values());
}
