import { db } from "@/db";
import { members } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// 将 SQLite 返回的 tags JSON 字符串解析为数组
function parseRow(row: any) {
  return {
    ...row,
    tags: typeof row.tags === "string" ? JSON.parse(row.tags) : row.tags || [],
  };
}

export async function GET(request: Request) {
  try {
    const householdId = Number(new URL(request.url).searchParams.get("householdId"));
    if (!householdId) {
      return Response.json({ message: "缺少住户编号" }, { status: 400 });
    }
    const data = await db.select().from(members).where(eq(members.householdId, householdId));
    return Response.json(data.map(parseRow));
  } catch (error) {
    console.error("Unable to load members", error);
    return Response.json({ message: "无法读取成员数据" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.householdId || !body.name || !body.relation) {
      return Response.json({ message: "请完整填写成员信息" }, { status: 400 });
    }
    const [created] = await db
      .insert(members)
      .values({
        householdId: Number(body.householdId),
        name: body.name.trim(),
        relation: body.relation,
        age: body.age ? Number(body.age) : null,
        gender: body.gender || null,
        tags: JSON.stringify(Array.isArray(body.tags) ? body.tags : []) as any,
      } as any)
      .returning();
    return Response.json(parseRow(created), { status: 201 });
  } catch (error) {
    console.error("Unable to create member", error);
    return Response.json({ message: "保存成员失败" }, { status: 500 });
  }
}
