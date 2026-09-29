export type ValidationEnvironment = {
  [key: string]: string | undefined;
  OPENAI_API_KEY?: string;
  OPENAI_VALIDATION_MODEL?: string;
  OPENAI_VALIDATION_ENABLED?: string;
  CODEX_VALIDATION_ENABLED?: string;
};

export const DEFAULT_VALIDATION_MODEL = "gpt-5-mini";

export function isValidationEnabled(environment: ValidationEnvironment = process.env) {
  return (environment.OPENAI_VALIDATION_ENABLED ?? environment.CODEX_VALIDATION_ENABLED) === "true";
}

// Legacy callers keep the same enable check; local process isolation is obsolete.
export const isCodexValidationEnabled = isValidationEnabled;
