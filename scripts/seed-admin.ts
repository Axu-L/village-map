/**
 * 用户种子脚本：初始化管理员账号
 * 用法：npx tsx scripts/seed-admin.ts
 *
 * 环境变量：
 * - ADMIN_USERNAME（默认 admin）
 * - ADMIN_PASSWORD（默认 admin123，仅开发环境）
 * - ADMIN_DISPLAY_NAME（默认 管理员）
 * - JWT_SECRET（鉴权密钥，建议生产环境设置）
 */
import "dotenv/config";
import { db } from "../src/db";
import { users } from "../src/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function main() {
  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "admin123";
  const displayName = process.env.ADMIN_DISPLAY_NAME || "管理员";

  const passwordHash = await bcrypt.hash(password, 10);

  // 查询是否已存在
  const [existing] = await db.select().from(users).where(eq(users.username, username));

  if (existing) {
    // 更新密码
    await db.update(users).set({ passwordHash, displayName }).where(eq(users.id, existing.id));
    console.log(`✓ 已更新用户 "${username}" 的密码`);
  } else {
    // 插入新用户
    await db.insert(users).values({ username, passwordHash, displayName, role: "admin" });
    console.log(`✓ 已创建用户 "${username}" / "${password}"`);
  }

  console.log("种子完成");
  process.exit(0);
}

main().catch((err) => {
  console.error("种子失败:", err);
  process.exit(1);
});
