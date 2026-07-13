import { db } from "@/db";
import { households } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// 将 SQLite 返回的 tags JSON 字符串解析为数组
function parseRow(row: any) {
  return {
    ...row,
    tags: typeof row.tags === "string" ? JSON.parse(row.tags) : row.tags || [],
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [data] = await db.select().from(households).where(eq(households.id, Number(id)));
    if (!data) {
      return Response.json({ message: "住户不存在" }, { status: 404 });
    }
    return Response.json(parseRow(data));
  } catch (error) {
    console.error("Unable to load household", error);
    return Response.json({ message: "无法读取住户数据" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const [updated] = await db
      .update(households)
      .set({
        ...body.headName && { headName: body.headName.trim() },
        ...body.headName && { householdName: body.householdName?.trim() || `${body.headName.trim()}家` },
        ...body.phone && { phone: body.phone.trim() },
        ...body.groupName && { groupName: body.groupName },
        ...body.address && { address: body.address.trim() },
        ...body.memberCount && { memberCount: Number(body.memberCount) },
        ...body.tags && { tags: JSON.stringify(Array.isArray(body.tags) ? body.tags : []) },
        ...body.latitude && { latitude: String(body.latitude) },
        ...body.longitude && { longitude: String(body.longitude) },
      })
      .where(eq(households.id, Number(id)))
      .returning();
    if (!updated) {
      return Response.json({ message: "住户不存在" }, { status: 404 });
    }
    return Response.json(parseRow(updated));
  } catch (error) {
    console.error("Unable to update household", error);
    return Response.json({ message: "更新失败" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [deleted] = await db.delete(households).where(eq(households.id, Number(id))).returning();
    if (!deleted) {
      return Response.json({ message: "住户不存在" }, { status: 404 });
    }
    return Response.json({ message: "删除成功" });
  } catch (error) {
    console.error("Unable to delete household", error);
    return Response.json({ message: "删除失败" }, { status: 500 });
  }
}
