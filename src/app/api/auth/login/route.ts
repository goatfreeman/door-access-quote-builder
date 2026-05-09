export async function POST() {
  return Response.json({ error: "Use Auth.js credentials sign-in." }, { status: 410 });
}
