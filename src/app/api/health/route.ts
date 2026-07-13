import { db } from "@/db";
import { households } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.select().from(households).limit(1);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
