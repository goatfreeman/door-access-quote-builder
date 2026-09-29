// Compatibility exports for the original server adapter module.
export { getValidationStatus as getCodexStatus, runValidationAgent as runCodexAgent } from "./hosted";
export type { ValidationStatus as CodexStatus } from "./hosted";
