import { db } from "@/db";
import { households } from "@/db/schema";
import { eq } from "drizzle-orm";
import { parseRow } from "@/lib/db-utils";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const idNum = Number(id);
    if (isNaN(idNum)) {
      return Response.json({ message: "无效的 ID" }, { status: 400 });
    }
    const [data] = await db.select().from(households).where(eq(households.id, idNum));
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
    const idNum = Number(id);
    if (isNaN(idNum)) {
      return Response.json({ message: "无效的 ID" }, { status: 400 });
    }
    const body = await request.json();

    // 构建更新字段：用 !== undefined / != null 判断，避免 falsy 值（0、""）被短路
    const updateFields: Record<string, unknown> = {};
    if (body.headName !== undefined) {
      updateFields.headName = body.headName.trim();
    }
    // householdName 独立于 headName 判断
    if (body.householdName !== undefined) {
      updateFields.householdName = body.householdName?.trim() || (body.headName ? `${body.headName.trim()}家` : undefined);
    }
    if (body.phone !== undefined) {
      updateFields.phone = body.phone.trim();
    }
    if (body.groupName !== undefined) {
      updateFields.groupName = body.groupName;
    }
    if (body.address !== undefined) {
      updateFields.address = body.address.trim();
    }
    // memberCount 用 != null 判断，支持设为 0
    if (body.memberCount != null) {
      updateFields.memberCount = Number(body.memberCount);
    }
    if (body.tags !== undefined) {
      updateFields.tags = JSON.stringify(Array.isArray(body.tags) ? body.tags : []);
    }
    if (body.latitude !== undefined) {
      updateFields.latitude = String(body.latitude);
    }
    if (body.longitude !== undefined) {
      updateFields.longitude = String(body.longitude);
    }

    const [updated] = await db
      .update(households)
      .set(updateFields)
      .where(eq(households.id, idNum))
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
    const idNum = Number(id);
    if (isNaN(idNum)) {
      return Response.json({ message: "无效的 ID" }, { status: 400 });
    }
    const [deleted] = await db.delete(households).where(eq(households.id, idNum)).returning();
    if (!deleted) {
      return Response.json({ message: "住户不存在" }, { status: 404 });
    }
    return Response.json({ message: "删除成功" });
  } catch (error) {
    console.error("Unable to delete household", error);
    return Response.json({ message: "删除失败" }, { status: 500 });
  }
}
