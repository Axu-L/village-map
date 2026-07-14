import { db } from "@/db";
import { households, members, visits, users } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 检查所有关键表是否可读
    await Promise.all([
      db.select().from(households).limit(1),
      db.select().from(members).limit(1),
      db.select().from(visits).limit(1),
      db.select().from(users).limit(1),
    ]);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
