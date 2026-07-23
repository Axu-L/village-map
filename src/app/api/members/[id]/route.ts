import { db } from "@/db";
import { members } from "@/db/schema";
import { eq } from "drizzle-orm";
import { parseRow } from "@/lib/db-utils";

export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const idNum = Number(id);
    if (isNaN(idNum)) {
      return Response.json({ message: "无效的 ID" }, { status: 400 });
    }
    const body = await request.json();

    const updateFields: Record<string, unknown> = {};
    if (body.name !== undefined) {
      updateFields.name = body.name.trim();
    }
    if (body.relation !== undefined) {
      updateFields.relation = body.relation;
    }
    // age 支持清空为 null：用 "age" in body 判断字段是否存在
    if ("age" in body) {
      updateFields.age = body.age === null ? null : Number(body.age);
    }
    if (body.gender !== undefined) {
      updateFields.gender = body.gender;
    }
    if (body.tags !== undefined) {
      updateFields.tags = JSON.stringify(Array.isArray(body.tags) ? body.tags : []);
    }

    const [updated] = await db
      .update(members)
      .set(updateFields)
      .where(eq(members.id, idNum))
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
    const idNum = Number(id);
    if (isNaN(idNum)) {
      return Response.json({ message: "无效的 ID" }, { status: 400 });
    }
    const [deleted] = await db.delete(members).where(eq(members.id, idNum)).returning();
    if (!deleted) {
      return Response.json({ message: "成员不存在" }, { status: 404 });
    }
    return Response.json({ message: "删除成功" });
  } catch (error) {
    console.error("Unable to delete member", error);
    return Response.json({ message: "删除失败" }, { status: 500 });
  }
}
