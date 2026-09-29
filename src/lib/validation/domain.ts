export const evidenceStatuses = [
  "CONFIRMED",
  "ASSUMED",
  "OPEN",
  "CONFLICT",
  "BLOCKED",
  "NOT APPLICABLE",
] as const;

export type EvidenceStatus = (typeof evidenceStatuses)[number];
export type AgentRole = "researcher" | "verifier" | "tester";

export type CompatibilityRequest = {
  manufacturer: string;
  sourcePartNumber: string;
  normalizedLookupKey: string;
  description: string;
  relatedItems: string[];
  question: string;
};

export type AgentFinding = {
  title: string;
  detail: string;
  status: EvidenceStatus;
  affectedItems: string[];
  evidence: string[];
  recommendedAction: string;
};

export type AgentReport = {
  role: AgentRole;
  status: EvidenceStatus;
  summary: string;
  findings: AgentFinding[];
  sources: string[];
};

export type CompatibilityResult = {
  request: CompatibilityRequest;
  reports: AgentReport[];
  finalStatus: EvidenceStatus;
  decisionNotice: string;
};

export type QuoteValidationLine = {
  sourceRowId: string;
  sourcePartNumber: string;
  quantity: number;
  unitCost: number;
  extendedCost: number;
  unitSell: number;
  extendedSell: number;
  explicitCredit?: boolean;
};

export type DeterministicFinding = {
  ruleId: "RULE-014";
  status: EvidenceStatus;
  severity: "ERROR";
  sourceRowId: string;
  sourcePartNumber: string;
  expected: number | string;
  actual: number;
  formula: string;
  units: "items" | "USD";
  designMargin: "NOT APPLICABLE";
};

type CompatibilityRequestInput = {
  manufacturer: unknown;
  sourcePartNumber: unknown;
  description: unknown;
  relatedItems: unknown;
  question: unknown;
};

const roles = new Set<AgentRole>(["researcher", "verifier", "tester"]);
const statuses = new Set<EvidenceStatus>(evidenceStatuses);

export function normalizeCompatibilityRequest(input: CompatibilityRequestInput): CompatibilityRequest {
  const sourcePartNumber = requiredText(input.sourcePartNumber, "sourcePartNumber", 160);
  if (!Array.isArray(input.relatedItems)) throw new Error("relatedItems must be an array");
  if (input.relatedItems.length > 25) throw new Error("relatedItems exceeds 25 entries");
  const relatedItems = input.relatedItems
    .map((item, index) => {
      if (typeof item !== "string") throw new Error(`relatedItems[${index}] must be text`);
      const trimmed = item.trim();
      if (trimmed.length > 160) throw new Error(`relatedItems[${index}] exceeds 160 characters`);
      return trimmed;
    })
    .filter(Boolean);
  return {
    manufacturer: requiredText(input.manufacturer, "manufacturer", 160),
    sourcePartNumber,
    normalizedLookupKey: sourcePartNumber.toUpperCase().replace(/[^A-Z0-9]/g, ""),
    description: requiredText(input.description, "description", 1_000),
    relatedItems,
    question: requiredText(input.question, "question", 2_000),
  };
}

export function parseAgentReport(value: unknown): AgentReport {
  const report = objectValue(value, "agent report");
  const role = report.role;
  const status = report.status;
  if (typeof role !== "string" || !roles.has(role as AgentRole)) throw new Error("Invalid agent role");
  if (typeof status !== "string" || !statuses.has(status as EvidenceStatus)) throw new Error("Invalid evidence status");

  const sources = stringArray(report.sources, "sources");
  for (const source of sources) {
    let url: URL;
    try {
      url = new URL(source);
    } catch {
      throw new Error("Evidence source must use http or https");
    }
    if ((url.protocol !== "http:" && url.protocol !== "https:") || !url.hostname) {
      throw new Error("Evidence source must use http or https");
    }
  }

  const rawFindings = Array.isArray(report.findings) ? report.findings : fail("findings must be an array");
  const findings = rawFindings.map((candidate, index) => parseAgentFinding(candidate, index));
  return {
    role: role as AgentRole,
    status: status as EvidenceStatus,
    summary: requiredText(report.summary, "summary", 10_000),
    findings,
    sources,
  };
}

export function runDeterministicRules(lines: QuoteValidationLine[]): DeterministicFinding[] {
  const findings: DeterministicFinding[] = [];
  for (const line of lines) {
    if (line.quantity < 0 && !line.explicitCredit) {
      findings.push({
        ruleId: "RULE-014",
        status: "BLOCKED",
        severity: "ERROR",
        sourceRowId: line.sourceRowId,
        sourcePartNumber: line.sourcePartNumber,
        expected: "quantity must be nonnegative unless the row is an explicit credit",
        actual: line.quantity,
        formula: "quantity ≥ 0 or explicit credit = true",
        units: "items",
        designMargin: "NOT APPLICABLE",
      });
      continue;
    }

    addMoneyVariance(findings, line, line.quantity * line.unitCost, line.extendedCost, "extended cost = quantity × unit cost");
    addMoneyVariance(findings, line, line.quantity * line.unitSell, line.extendedSell, "extended sell = quantity × unit sell");
  }
  return findings;
}

function addMoneyVariance(findings: DeterministicFinding[], line: QuoteValidationLine, expected: number, actual: number, formula: string) {
  if (Math.abs(expected - actual) < 0.005) return;
  findings.push({
    ruleId: "RULE-014",
    status: "CONFLICT",
    severity: "ERROR",
    sourceRowId: line.sourceRowId,
    sourcePartNumber: line.sourcePartNumber,
    expected: roundCurrency(expected),
    actual,
    formula,
    units: "USD",
    designMargin: "NOT APPLICABLE",
  });
}

function parseAgentFinding(value: unknown, index: number): AgentFinding {
  const finding = objectValue(value, `finding ${index + 1}`);
  const status = finding.status;
  if (typeof status !== "string" || !statuses.has(status as EvidenceStatus)) throw new Error(`Invalid finding ${index + 1} status`);
  return {
    title: requiredText(finding.title, `finding ${index + 1} title`, 500),
    detail: requiredText(finding.detail, `finding ${index + 1} detail`, 10_000),
    status: status as EvidenceStatus,
    affectedItems: stringArray(finding.affectedItems, `finding ${index + 1} affectedItems`),
    evidence: stringArray(finding.evidence, `finding ${index + 1} evidence`),
    recommendedAction: requiredText(finding.recommendedAction, `finding ${index + 1} recommendedAction`, 5_000),
  };
}

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function stringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) throw new Error(`${label} must be a string array`);
  return value as string[];
}

function requiredText(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required`);
  const trimmed = value.trim();
  if (trimmed.length > maxLength) throw new Error(`${label} exceeds ${maxLength} characters`);
  return trimmed;
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function fail(message: string): never {
  throw new Error(message);
}