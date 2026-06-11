import type { QuoteLine } from "@/lib/types";

export type QuoteLineGroup =
  | { type: "line"; line: QuoteLine }
  | { type: "package"; key: string; title: string; lines: QuoteLine[] };

export function quoteLinePrimaryLabel(line: QuoteLine) {
  return line.packageNickname?.trim() || line.packageName || line.name;
}

export function quoteLineSecondaryLabel(line: QuoteLine) {
  if (!line.packageName) return "";
  return line.name;
}

export function quoteLineExportGroup(line: QuoteLine) {
  return line.packageNickname?.trim() || line.packageName || "";
}

export function groupQuoteLines(lines: QuoteLine[]): QuoteLineGroup[] {
  const groups: QuoteLineGroup[] = [];
  const packageIndexes = new Map<string, number>();

  lines.forEach((line) => {
    if (!line.packageName) {
      groups.push({ type: "line", line });
      return;
    }

    const key = line.packageId ?? line.packageName;
    const existingIndex = packageIndexes.get(key);
    if (existingIndex === undefined) {
      packageIndexes.set(key, groups.length);
      groups.push({
        type: "package",
        key,
        title: line.packageNickname?.trim() || line.packageName,
        lines: [line],
      });
      return;
    }

    const existing = groups[existingIndex];
    if (existing.type === "package") existing.lines.push(line);
  });

  return groups;
}
