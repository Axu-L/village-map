/**
 * 一次性迁移脚本：将 households/members 的旧标签映射到新标签（去重）
 * 旧 → 新 映射见 src/lib/tags.ts 的 tagMigrationMap
 * 运行：npx tsx scripts/migrate-tags.ts
 */
import Database from "better-sqlite3";
import path from "path";
import { tagMigrationMap, allTags } from "../src/lib/tags";

const dbPath = path.join(process.cwd(), "data", "app.db");
const sqlite = new Database(dbPath);
sqlite.pragma("foreign_keys = ON");

const newTagSet = new Set<string>(allTags);

function migrateTags(raw: string | null | undefined): { tags: string[]; changed: boolean } {
  if (!raw) return { tags: [], changed: false };
  let arr: unknown;
  try {
    arr = JSON.parse(raw);
  } catch {
    return { tags: [], changed: false };
  }
  if (!Array.isArray(arr)) return { tags: [], changed: false };

  const migrated: string[] = [];
  const seen = new Set<string>();
  for (const t of arr) {
    if (typeof t !== "string") continue;
    const next = tagMigrationMap[t] ?? (newTagSet.has(t) ? t : null);
    if (next && !seen.has(next)) {
      seen.add(next);
      migrated.push(next);
    }
  }
  const original = arr.filter((t) => typeof t === "string");
  const changed =
    migrated.length !== original.length ||
    migrated.some((t, i) => t !== original[i]);
  return { tags: migrated, changed };
}

function migrateTable(table: "households" | "members") {
  const rows = sqlite.prepare(`SELECT id, tags FROM ${table}`).all() as {
    id: number;
    tags: string;
  }[];
  const update = sqlite.prepare(
    `UPDATE ${table} SET tags = ? WHERE id = ?`
  );
  let changedCount = 0;
  for (const row of rows) {
    const { tags, changed } = migrateTags(row.tags);
    if (changed) {
      update.run(JSON.stringify(tags), row.id);
      changedCount++;
      console.log(`  [${table}] id=${row.id}: ${row.tags} -> ${JSON.stringify(tags)}`);
    }
  }
  console.log(`${table}: ${changedCount}/${rows.length} 行已更新`);
}

console.log("开始迁移标签...");
migrateTable("households");
migrateTable("members");

// 验证结果
const sample = sqlite
  .prepare(`SELECT id, household_name, tags FROM households LIMIT 20`)
  .all() as { id: number; household_name: string; tags: string }[];
console.log("\n迁移后样本:");
for (const r of sample) {
  console.log(`  id=${r.id} ${r.household_name}: ${r.tags}`);
}

sqlite.close();
console.log("\n迁移完成。");
