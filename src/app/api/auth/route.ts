import { findUserByUsername, comparePassword, signToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 内存级登录速率限制：单 IP 5 次失败后冷却 60 秒（单实例部署够用，多实例需换 Redis）
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();
const MAX_ATTEMPTS = 5;
const LOCK_MS = 60_000;

export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const now = Date.now();

    // 检查是否已被锁定
    const record = loginAttempts.get(ip);
    if (record && record.lockedUntil > now) {
      return Response.json(
        { message: "尝试过于频繁，请 1 分钟后再试" },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return Response.json({ message: "请输入用户名和密码" }, { status: 400 });
    }

    // 从数据库查询用户
    const user = await findUserByUsername(username.trim());
    if (!user) {
      recordFailedAttempt(ip, now);
      return Response.json({ message: "用户名或密码错误" }, { status: 401 });
    }

    // 校验密码
    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      recordFailedAttempt(ip, now);
      return Response.json({ message: "用户名或密码错误" }, { status: 401 });
    }

    // 登录成功：清除失败记录
    loginAttempts.delete(ip);

    // 签发 JWT token
    const authUser = {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    };
    const token = await signToken(authUser);

    return Response.json({ token, user: authUser });
  } catch (error) {
    console.error("Login error", error);
    return Response.json({ message: "登录失败" }, { status: 500 });
  }
}

/** 记录失败尝试，达到阈值后锁定 */
function recordFailedAttempt(ip: string, now: number): void {
  const r = loginAttempts.get(ip) || { count: 0, lockedUntil: 0 };
  r.count++;
  if (r.count >= MAX_ATTEMPTS) {
    r.lockedUntil = now + LOCK_MS;
    r.count = 0;
  }
  loginAttempts.set(ip, r);
}
