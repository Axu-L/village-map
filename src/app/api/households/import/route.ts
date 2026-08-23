import * as XLSX from "xlsx";
import { db } from "@/db";
import { households } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { parseRow } from "@/lib/db-utils";
import { GROUP_NAMES } from "@/lib/constants";
import type { Tag } from "@/types";

export const dynamic = "force-dynamic";

// 身份类别 → 系统标签映射（三留守及独居老人信息登记表）
const CATEGORY_TAG_MAP: Record<string, Tag> = {
  独居老人: "独居老人",
  留守老人: "三留守",
  留守妇女: "三留守",
  留守儿童: "三留守",
  困境儿童: "三留守",
};

// 组别归一化：「一组」→「第一组」、「十组」→「第十组」
function normalizeGroup(raw: string): string | null {
  const s = String(raw || "").trim();
  if (!s) return null;
  // 已是标准格式
  if ((GROUP_NAMES as readonly string[]).includes(s)) return s;
  // 中文数字 → 阿拉伯数字序号
  const cnMap: Record<string, number> = {
    一: 1, 二: 2, 三: 3, 四: 4, 五: 5,
    六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
  };
  const m = s.match(/^(第?)([一二三四五六七八九十])组$/);
  if (m) {
    const idx = cnMap[m[2]];
    if (idx && idx >= 1 && idx <= 10) return GROUP_NAMES[idx - 1];
  }
  return null;
}

// 联系电话归一化：「无电话」/空 → 空串；脱敏号原样保留
function normalizePhone(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  const s = String(raw).trim();
  if (!s || s === "无电话") return "";
  return s;
}

interface ParsedHousehold {
  householdName: string;
  headName: string;
  phone: string;
  groupName: string;
  address: string;
  memberCount: number;
  tags: Tag[];
}

/**
 * 从工作表行数组解析住户记录
 * 表头（第 2 行）：序号 | 身份类别 | 组别 | 姓名 | 性别 | 年龄 | 联系电话 | 家庭住址 | 备注
 * 第 1 行为标题行，数据从第 3 行起
 */
function parseRows(rows: unknown[][]): ParsedHousehold[] {
  const result: ParsedHousehold[] = [];
  // 找到表头行（含「身份类别」），数据从下一行开始
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const cells = (rows[i] || []).map((c) => String(c ?? "").trim());
    if (cells.includes("身份类别") && cells.includes("姓名")) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return result;

  const header = (rows[headerIdx] || []).map((c) => String(c ?? "").trim());
  const colIdx = {
    category: header.indexOf("身份类别"),
    group: header.indexOf("组别"),
    name: header.indexOf("姓名"),
    phone: header.indexOf("联系电话"),
    address: header.indexOf("家庭住址"),
  };

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => c === null || c === undefined || String(c).trim() === "")) {
      continue; // 跳过空行
    }

    const headName = String(row[colIdx.name] ?? "").trim();
    if (!headName) continue;

    const category = String(row[colIdx.category] ?? "").trim();
    const groupName = normalizeGroup(String(row[colIdx.group] ?? ""));
    const phone = normalizePhone(row[colIdx.phone]);
    const address = String(row[colIdx.address] ?? "").trim() || groupName || "";

    const tags: Tag[] = [];
    const tag = CATEGORY_TAG_MAP[category];
    if (tag && !tags.includes(tag)) tags.push(tag);

    // 组别无法识别时跳过该行（系统强校验组别）
    if (!groupName) continue;

    result.push({
      householdName: `${headName}家`,
      headName,
      phone,
      groupName,
      address,
      memberCount: 1,
      tags,
    });
  }
  return result;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return Response.json({ message: "请选择 xlsx 文件" }, { status: 400 });
    }

    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    if (ext !== ".xlsx" && ext !== ".xls") {
      return Response.json({ message: "仅支持 .xlsx / .xls 格式" }, { status: 400 });
    }

    // 解析 Excel
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) {
      return Response.json({ message: "文件中没有工作表" }, { status: 400 });
    }
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: true,
      defval: null,
    }) as unknown[][];

    const parsed = parseRows(rows);
    if (parsed.length === 0) {
      return Response.json(
        { message: "未解析到有效数据，请检查文件格式（需包含 身份类别/组别/姓名 等列）" },
        { status: 400 }
      );
    }

    let success = 0;
    let skipped = 0;
    let failed = 0;
    const errors: { name: string; reason: string }[] = [];

    for (const item of parsed) {
      try {
        // 重复校验：户主姓名 + 组别 + 电话 完全相同视为重复
        const existing = await db
          .select()
          .from(households)
          .where(
            and(
              eq(households.headName, item.headName),
              eq(households.groupName, item.groupName),
              eq(households.phone, item.phone)
            )
          );
        if (existing.length > 0) {
          skipped++;
          continue;
        }

        await db
          .insert(households)
          .values({
            householdName: item.householdName,
            headName: item.headName,
            phone: item.phone,
            groupName: item.groupName,
            address: item.address,
            memberCount: item.memberCount,
            tags: JSON.stringify(item.tags) as any,
            // Excel 无坐标信息，默认 0,0（后续可在地图页补点）
            latitude: "0",
            longitude: "0",
            lastVisitAt: null,
          } as any);
        success++;
      } catch (err) {
        failed++;
        errors.push({
          name: item.headName,
          reason: err instanceof Error ? err.message : "写入失败",
        });
      }
      // 记录最近一次成功的样本用于返回预览
    }

    // 取最新导入的几条作为预览（按 id 倒序，取前 5 条）
    const recent = await db
      .select()
      .from(households)
      .orderBy(desc(households.id))
      .limit(Math.min(success, 5));

    return Response.json({
      total: parsed.length,
      success,
      skipped,
      failed,
      errors: errors.slice(0, 20),
      preview: recent.map(parseRow),
    });
  } catch (error) {
    console.error("xlsx 导入失败", error);
    return Response.json(
      { message: "导入失败：" + (error instanceof Error ? error.message : "未知错误") },
      { status: 500 }
    );
  }
}
