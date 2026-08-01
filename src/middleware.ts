import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";

// 公开路径（无需鉴权）
const PUBLIC_PATHS = ["/api/auth", "/api/health"];

// 需要鉴权的 API 路径前缀（所有方法，含 GET）
const PROTECTED_PREFIXES = ["/api/households", "/api/members", "/api/visits", "/api/upload", "/api/settings"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 上传照片：UUID 不可枚举 + noindex 已兜底，无需 Referer 校验
  // （nginx 反代场景下 request 中的 origin 是内部容器地址，与浏览器 Referer 必然不一致，
  //  同源校验会误伤所有合法图片请求，因此移除该校验）
  if (pathname.startsWith("/uploads/")) {
    return NextResponse.next();
  }

  // 公开路径放行
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (isPublic) {
    return NextResponse.next();
  }

  // 检查是否是需要鉴权的路径
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isProtected) {
    return NextResponse.next();
  }

  // 提取并验证 token
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json({ message: "未登录" }, { status: 401 });
  }

  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
  const user = await verifyToken(token);

  if (!user) {
    return NextResponse.json({ message: "登录已过期，请重新登录" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  // 匹配 /api 路径 + /uploads 静态资源（同源 Referer 校验）
  matcher: ["/api/:path*", "/uploads/:path*"],
};
