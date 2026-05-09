export async function GET(request: Request) {
  return Response.redirect(new URL("/api/auth/callback/microsoft-entra-id", request.url));
}
