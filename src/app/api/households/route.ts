import { db } from "@/db";
import { households } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { parseRow } from "@/lib/db-utils";
import { validateLat, validateLng, validatePhone, validateGroupName, validateMemberCount } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await db.select().from(households).orderBy(asc(households.id));
    return Response.json(data.map(parseRow));
  } catch (error) {
    console.error("Unable to load households", error);
    // 不再返回 demo 数据掩盖故障，明确返回错误
    return Response.json({ message: "无法读取住户数据" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const required = ["headName", "phone", "groupName", "address", "latitude", "longitude"];
    if (required.some((key) => !body[key])) {
      return Response.json({ message: "请完整填写住户信息与地图定位" }, { status: 400 });
    }

    // 输入校验
    if (!validatePhone(body.phone.trim())) {
      return Response.json({ message: "手机号格式不正确" }, { status: 400 });
    }
    if (!validateGroupName(body.groupName)) {
      return Response.json({ message: "组别不合法" }, { status: 400 });
    }
    if (!validateLat(body.latitude) || !validateLng(body.longitude)) {
      return Response.json({ message: "坐标格式不正确" }, { status: 400 });
    }
    const mc = Number(body.memberCount) || 1;
    if (!validateMemberCount(mc)) {
      return Response.json({ message: "家庭成员数不合法（1-50）" }, { status: 400 });
    }

    // 重复校验：户主姓名 + 组别 + 电话 完全相同视为重复
    const headNameTrim = body.headName.trim();
    const phoneTrim = body.phone.trim();
    const groupNameVal = body.groupName;
    const existing = await db
      .select()
      .from(households)
      .where(
        and(
          eq(households.headName, headNameTrim),
          eq(households.groupName, groupNameVal),
          eq(households.phone, phoneTrim)
        )
      );
    if (existing.length > 0) {
      return Response.json(
        { message: "该住户已存在（相同姓名、组别、电话）", duplicate: true },
        { status: 409 }
      );
    }

    const [created] = await db
      .insert(households)
      .values({
        householdName: body.householdName?.trim() || `${body.headName.trim()}家`,
        headName: headNameTrim,
        phone: phoneTrim,
        groupName: groupNameVal,
        address: body.address.trim(),
        memberCount: mc,
        tags: JSON.stringify(Array.isArray(body.tags) ? body.tags : []) as any,
        latitude: String(body.latitude),
        longitude: String(body.longitude),
        lastVisitAt: null,
      } as any)
      .returning();

    return Response.json(parseRow(created), { status: 201 });
  } catch (error) {
    console.error("Unable to create household", error);
    return Response.json({ message: "保存住户失败" }, { status: 500 });
  }
}
