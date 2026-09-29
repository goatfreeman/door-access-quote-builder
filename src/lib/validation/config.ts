type ValidationEnvironment = {
  CODEX_VALIDATION_ENABLED?: string;
  CODEX_VALIDATION_ISOLATED?: string;
  NODE_ENV?: string;
};

export function isCodexValidationEnabled(environment: ValidationEnvironment = process.env) {
  return environment.CODEX_VALIDATION_ENABLED === "true" && environment.CODEX_VALIDATION_ISOLATED === "true";
}