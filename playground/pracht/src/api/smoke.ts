import { db } from 'void/db';

export async function GET() {
  // The relational API needs the app's schema in `void/db`.
  const first = await db.query.users.findFirst({ columns: { name: true } });
  return Response.json({ firstUser: first ?? null });
}
