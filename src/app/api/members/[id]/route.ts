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

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const [updated] = await db
      .update(members)
      .set({
        ...body.name && { name: body.name.trim() },
        ...body.relation && { relation: body.relation },
        ...body.age != null && { age: Number(body.age) },
        ...body.gender && { gender: body.gender },
        ...body.tags && { tags: JSON.stringify(Array.isArray(body.tags) ? body.tags : []) },
      })
      .where(eq(members.id, Number(id)))
      .returning();
    if (!updated) {
      return Response.json({ message: "成员不存在" }, { status: 404 });
    }
    return Response.json(parseRow(updated));
  } catch (error) {
    console.error("Unable to update member", error);
    return Response.json({ message: "更新失败" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [deleted] = await db.delete(members).where(eq(members.id, Number(id))).returning();
    if (!deleted) {
      return Response.json({ message: "成员不存在" }, { status: 404 });
    }
    return Response.json({ message: "删除成功" });
  } catch (error) {
    console.error("Unable to delete member", error);
    return Response.json({ message: "删除失败" }, { status: 500 });
  }
}
