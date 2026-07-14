import jwt from "jsonwebtoken";

// 生产环境强制要求 JWT_SECRET，防止使用默认密钥导致 token 可伪造
const JWT_SECRET = process.env.JWT_SECRET;
if (process.env.NODE_ENV === "production" && !JWT_SECRET) {
  throw new Error("JWT_SECRET 必须在生产环境设置");
}
const SECRET = JWT_SECRET || "dev-insecure-secret-change-in-production";
const JWT_EXPIRES_IN = "7d";

export interface AuthUser {
  id: number;
  username: string;
  displayName: string;
  role: string;
}

/** 签发 JWT token */
export function signToken(user: AuthUser): string {
  return jwt.sign(
    { id: user.id, username: user.username, displayName: user.displayName, role: user.role },
    SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/** 验证 JWT token，失败返回 null */
export function verifyToken(token: string): AuthUser | null {
  try {
    const payload = jwt.verify(token, SECRET) as AuthUser;
    return payload;
  } catch {
    return null;
  }
}

/**
 * 从请求的 Authorization header 提取并验证 token
 * 返回认证用户或 null
 */
export function getAuthUser(request: Request): AuthUser | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
  return verifyToken(token);
}
