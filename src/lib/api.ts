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
