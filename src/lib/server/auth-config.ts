function splitEnvList(value?: string) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function isAzureSsoEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const domain = normalizedEmail.split("@")[1] ?? "";
  const ssoEmails = splitEnvList(process.env.AZURE_SSO_EMAILS);
  const ssoDomains = splitEnvList(process.env.AZURE_SSO_DOMAINS);
  return ssoEmails.includes(normalizedEmail) || Boolean(domain && ssoDomains.includes(domain));
}

export function getLoginMethod(email: string): "password" | "azure" {
  const normalizedEmail = email.trim().toLowerCase();
  return isAzureSsoEmail(normalizedEmail) ? "azure" : "password";
}
