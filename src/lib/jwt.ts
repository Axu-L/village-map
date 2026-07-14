import { SignJWT, jwtVerify } from "jose";

// 生产环境强制要求 JWT_SECRET，防止使用默认密钥导致 token 可伪造
const JWT_SECRET = process.env.JWT_SECRET;
if (process.env.NODE_ENV === "production" && !JWT_SECRET) {
  throw new Error("JWT_SECRET 必须在生产环境设置");
}
const SECRET = JWT_SECRET || "dev-insecure-secret-change-in-production";
const JWT_EXPIRES_IN = "7d";

// jose 使用 Web Crypto API，密钥需以 Uint8Array 形式提供（Edge Runtime 兼容）
const secretKey = new TextEncoder().encode(SECRET);

export interface AuthUser {
  id: number;
  username: string;
  displayName: string;
  role: string;
}

/** 签发 JWT token（jose 基于 Web Crypto API，Node.js 与 Edge Runtime 均可用） */
export async function signToken(user: AuthUser): Promise<string> {
  return await new SignJWT({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRES_IN)
    .sign(secretKey);
}

/** 验证 JWT token，失败返回 null */
export async function verifyToken(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    return payload as unknown as AuthUser;
  } catch {
    return null;
  }
}

/**
 * 从请求的 Authorization header 提取并验证 token
 * 返回认证用户或 null
 */
export async function getAuthUser(request: Request): Promise<AuthUser | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
  return verifyToken(token);
}
