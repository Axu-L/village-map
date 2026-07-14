import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";

// 公开路径（无需鉴权）
const PUBLIC_PATHS = ["/api/auth", "/api/health"];

// 需要鉴权的 API 路径前缀（所有方法，含 GET）
const PROTECTED_PREFIXES = ["/api/households", "/api/members", "/api/visits", "/api/upload"];

export async function middleware(request: NextRequest) {
  const { pathname, origin } = request.nextUrl;

  // 上传照片：同源 Referer 校验，防止外站直接引用（UUID 不可枚举 + noindex 已兜底）
  // 仅当 Referer 存在且明确跨域时才拦截；无 Referer（隐私浏览器/直接访问）放行
  if (pathname.startsWith("/uploads/")) {
    const referer = request.headers.get("referer");
    if (referer) {
      try {
        const refererOrigin = new URL(referer).origin;
        if (refererOrigin !== origin) {
          return new NextResponse("Forbidden", { status: 403 });
        }
      } catch {
        // Referer 解析失败，放行（不因畸形 header 阻断合法访问）
      }
    }
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
