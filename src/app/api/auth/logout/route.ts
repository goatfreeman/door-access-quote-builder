export async function POST() {
  return Response.json({ error: "Use Auth.js signOut." }, { status: 410 });
}
