// 与 next.config.ts 中的 basePath 保持一致（由 next.config.ts 的 env 注入）
// Next.js 的 basePath 只会自动给 <Link>、next/router、<Image> 加前缀，
// fetch 请求和静态资源 URL 需要手动拼接。
export const API_BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

/**
 * 将 API 路径拼上 basePath 前缀
 * @example apiUrl("/api/households") -> "/village-map/api/households"
 *          apiUrl(`/api/households/${id}`) -> "/village-map/api/households/123"
 */
export function apiUrl(path: string): string {
  if (!path.startsWith("/")) path = "/" + path;
  return API_BASE + path;
}

/**
 * 将静态资源路径（如上传的图片）拼上 basePath 前缀
 * @example assetUrl("/uploads/xxx.jpg") -> "/village-map/uploads/xxx.jpg"
 */
export function assetUrl(path: string): string {
  if (!path) return path;
  // 已经是完整 URL（http/https）则不处理
  if (/^https?:\/\//.test(path)) return path;
  if (!path.startsWith("/")) path = "/" + path;
  return API_BASE + path;
}

/**
 * 带有 HTTP 状态码的错误类，方便调用方区分 401/403/500 等
 */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * 统一的 API 请求封装：自动校验 res.ok，失败时抛 ApiError（含状态码）
 * 自动携带 Authorization header（从 localStorage 读取 token）
 * 替代各页面裸 fetch + 手动 r.json() 的模式
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function apiFetch(path: string, options?: RequestInit): Promise<any> {
  // 自动注入 token（仅浏览器环境）
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string>),
  };
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token && !headers["Authorization"]) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const res = await fetch(apiUrl(path), { ...options, headers });
  if (!res.ok) {
    let message = `请求失败 (${res.status})`;
    try {
      const err = await res.json();
      message = err.message || message;
    } catch {
      // 响应非 JSON，使用默认 message
    }
    // 401：token 过期或无效，清除登录态并跳转登录页（仅浏览器环境）
    if (res.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = apiUrl("/login");
    }
    throw new ApiError(message, res.status);
  }

  // 成功分支：安全解析 JSON，非 JSON 响应返回 null
  try {
    return await res.json();
  } catch {
    return null;
  }
}
