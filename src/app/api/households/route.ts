import { db } from "@/db";
import { households } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const demoHouseholds = [
  {
    householdName: "张三家",
    headName: "张三",
    phone: "13800138001",
    groupName: "第五组",
    address: "花园村第五组 32 号",
    memberCount: 4,
    tags: '["脱贫户","独居老人"]',
    latitude: "30.5234",
    longitude: "114.3431",
    lastVisitAt: "2026-07-10",
  },
  {
    householdName: "李秀兰家",
    headName: "李秀兰",
    phone: "13900139008",
    groupName: "第三组",
    address: "花园村第三组 18 号",
    memberCount: 2,
    tags: '["监测户"]',
    latitude: "30.5268",
    longitude: "114.3387",
    lastVisitAt: "2026-07-02",
  },
  {
    householdName: "王建国家",
    headName: "王建国",
    phone: "13700137022",
    groupName: "第七组",
    address: "花园村第七组 6 号",
    memberCount: 3,
    tags: '["残疾人","脱贫户"]',
    latitude: "30.5201",
    longitude: "114.3484",
    lastVisitAt: "2026-06-25",
  },
  {
    householdName: "陈小兰家",
    headName: "陈小兰",
    phone: "13600136056",
    groupName: "第一组",
    address: "花园村第一组 46 号",
    memberCount: 1,
    tags: '["独居老人"]',
    latitude: "30.5302",
    longitude: "114.3332",
    lastVisitAt: "2026-06-18",
  },
  {
    householdName: "刘志强家",
    headName: "刘志强",
    phone: "13500135092",
    groupName: "第九组",
    address: "花园村第九组 9 号",
    memberCount: 5,
    tags: '["留守儿童"]',
    latitude: "30.5177",
    longitude: "114.3532",
    lastVisitAt: "2026-07-08",
  },
];

// 将 SQLite 返回的 tags JSON 字符串解析为数组
function parseRow(row: any) {
  return {
    ...row,
    tags: typeof row.tags === "string" ? JSON.parse(row.tags) : row.tags || [],
  };
}

export async function GET() {
  try {
    let data = await db.select().from(households).orderBy(asc(households.id));
    if (data.length === 0) {
      await db.insert(households).values(demoHouseholds as any);
      data = await db.select().from(households).orderBy(asc(households.id));
    }
    return Response.json(data.map(parseRow));
  } catch (error) {
    console.error("Unable to load households, using demo data", error);
    return Response.json(
      demoHouseholds.map((d) => ({ ...d, tags: JSON.parse(d.tags) }))
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const required = ["headName", "phone", "groupName", "address", "latitude", "longitude"];
    if (required.some((key) => !body[key])) {
      return Response.json({ message: "请完整填写住户信息与地图定位" }, { status: 400 });
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
        memberCount: Number(body.memberCount) || 1,
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
