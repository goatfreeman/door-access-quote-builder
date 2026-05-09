export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const email = requestUrl.searchParams.get("email");
  const signInUrl = new URL("/api/auth/signin/microsoft-entra-id", request.url);
  signInUrl.searchParams.set("callbackUrl", "/");
  if (email) signInUrl.searchParams.set("login_hint", email);
  return Response.redirect(signInUrl);
}
