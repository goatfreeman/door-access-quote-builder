export const tempUsers = [
  {
    id: "temp-admin",
    name: "Admin User",
    email: "qqb.admin@example.com",
    password: "QuoteAdmin2026!",
    provider: "password" as const,
    role: "admin" as const,
  },
  {
    id: "temp-tech",
    name: "Tech User",
    email: "qqb.tech@example.com",
    password: "QuoteTech2026!",
    provider: "password" as const,
    role: "user" as const,
  },
];

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
  if (tempUsers.some((user) => user.email.toLowerCase() === normalizedEmail)) return "password";
  return isAzureSsoEmail(normalizedEmail) ? "azure" : "password";
}
