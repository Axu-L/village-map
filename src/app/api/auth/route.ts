import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// Demo 登录：admin / admin123
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return Response.json({ message: "请输入用户名和密码" }, { status: 400 });
    }

    // Demo 模式：硬编码验证
    if (username === "admin" && password === "admin123") {
      return Response.json({
        token: "demo-token-" + Date.now(),
        user: { id: 1, username: "admin", displayName: "管理员", role: "admin" },
      });
    }

    return Response.json({ message: "用户名或密码错误" }, { status: 401 });
  } catch (error) {
    console.error("Login error", error);
    return Response.json({ message: "登录失败" }, { status: 500 });
  }
}
