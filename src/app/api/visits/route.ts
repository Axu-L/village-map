import { db } from "@/db";
import { visits, households } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { parseRow } from "@/lib/db-utils";
import { validateVisitDate } from "@/lib/validate";

export const dynamic = "force-dynamic";

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

    // 输入校验
    const householdIdNum = Number(body.householdId);
    if (isNaN(householdIdNum)) {
      return Response.json({ message: "住户编号不合法" }, { status: 400 });
    }
    if (!validateVisitDate(body.visitDate)) {
      return Response.json({ message: "走访日期格式不正确" }, { status: 400 });
    }

    const [created] = await db
      .insert(visits)
      .values({
        householdId: householdIdNum,
        visitor: body.visitor?.trim() || "村干部",
        visitDate: body.visitDate,
        content: body.content.trim(),
        concerns: JSON.stringify(Array.isArray(body.concerns) ? body.concerns : []) as any,
        images: JSON.stringify(Array.isArray(body.images) ? body.images : []) as any,
        imageCount: Array.isArray(body.images) ? body.images.length : (Number(body.imageCount) || 0),
      } as any)
      .returning();

    // 同步更新住户的最近走访时间（仅当本次走访日期更新或更晚时，避免补录早日期倒退）
    const [household] = await db
      .select({ lastVisitAt: households.lastVisitAt })
      .from(households)
      .where(eq(households.id, householdIdNum));
    if (household && (!household.lastVisitAt || body.visitDate >= household.lastVisitAt)) {
      await db
        .update(households)
        .set({ lastVisitAt: body.visitDate })
        .where(eq(households.id, householdIdNum));
    }

    return Response.json(parseRow(created), { status: 201 });
  } catch (error) {
    console.error("Unable to create visit", error);
    return Response.json({ message: "保存走访记录失败" }, { status: 500 });
  }
}
