import { db } from "@/db";
import { visits } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// 将 SQLite 返回的 concerns/images JSON 字符串解析为数组
function parseRow(row: any) {
  return {
    ...row,
    concerns: typeof row.concerns === "string" ? JSON.parse(row.concerns) : row.concerns || [],
    images: typeof row.images === "string" ? JSON.parse(row.images) : row.images || [],
  };
}

export async function GET(request: Request) {
  try {
    const householdId = new URL(request.url).searchParams.get("householdId");
    let data;
    if (householdId) {
      data = await db.select().from(visits).where(eq(visits.householdId, Number(householdId))).orderBy(desc(visits.visitDate));
    } else {
      data = await db.select().from(visits).orderBy(desc(visits.visitDate));
    }
    return Response.json(data.map(parseRow));
  } catch (error) {
    console.error("Unable to load visits", error);
    return Response.json({ message: "无法读取走访记录" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.householdId || !body.visitDate || !body.content?.trim()) {
      return Response.json({ message: "请填写日期和走访内容" }, { status: 400 });
    }

    const [created] = await db
      .insert(visits)
      .values({
        householdId: Number(body.householdId),
        visitor: body.visitor?.trim() || "村干部",
        visitDate: body.visitDate,
        content: body.content.trim(),
        concerns: JSON.stringify(Array.isArray(body.concerns) ? body.concerns : []) as any,
        images: JSON.stringify(Array.isArray(body.images) ? body.images : []) as any,
        imageCount: Array.isArray(body.images) ? body.images.length : (Number(body.imageCount) || 0),
      } as any)
      .returning();

    return Response.json(parseRow(created), { status: 201 });
  } catch (error) {
    console.error("Unable to create visit", error);
    return Response.json({ message: "保存走访记录失败" }, { status: 500 });
  }
}
