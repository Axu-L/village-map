import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

// 从 jwt.ts re-export（保持向后兼容，api/auth/route.ts 等仍从此处导入）
// 注意：middleware.ts 应直接从 @/lib/jwt 导入，避免将 db 依赖引入 Edge Runtime
export { signToken, verifyToken, getAuthUser } from "@/lib/jwt";
export type { AuthUser } from "@/lib/jwt";

/** 用 bcrypt 哈希密码 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/** 校验密码与哈希是否匹配 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** 通过用户名从数据库查询用户（含 passwordHash） */
export async function findUserByUsername(username: string) {
  const [user] = await db.select().from(users).where(eq(users.username, username));
  return user || null;
}
