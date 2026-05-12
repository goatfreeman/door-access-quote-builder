import type { QuoteLine } from "@/lib/types";

export function quoteLinePrimaryLabel(line: QuoteLine) {
  return line.packageNickname?.trim() || line.packageName || line.name;
}

export function quoteLineSecondaryLabel(line: QuoteLine) {
  if (!line.packageName) return "";
  return line.packageNickname?.trim() ? `${line.packageName} / ${line.name}` : line.name;
}

export function quoteLineExportGroup(line: QuoteLine) {
  return line.packageNickname?.trim() || line.packageName || "";
}
