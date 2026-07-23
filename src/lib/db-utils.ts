import type { Household } from "@/types";

/**
 * 安全解析 JSON 字符串字段，脏数据时回退为空数组，避免整个 GET 接口 500
 */
function safeJsonParse(s: unknown): unknown[] {
  if (typeof s !== "string") return Array.isArray(s) ? s : [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/**
 * 将 SQLite 返回的 JSON 字符串字段（tags/concerns/images）解析为数组
 * 供所有 API 路由复用，避免重复定义
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseRow(row: any): any {
  return {
    ...row,
    tags: safeJsonParse(row.tags),
    concerns: safeJsonParse(row.concerns),
    images: safeJsonParse(row.images),
  };
}

/**
 * 校验住户坐标是否有效（非 NaN、非全 0）
 */
export function isValidLatLng(h: { latitude?: string | number; longitude?: string | number }): boolean {
  const lng = Number(h.longitude);
  const lat = Number(h.latitude);
  return !isNaN(lng) && !isNaN(lat) && !(lng === 0 && lat === 0);
}

/**
 * 打开高德地图导航页面（SSR 安全）
 */
export function openNavigation(lng: number, lat: number, name: string): void {
  if (typeof window === "undefined") return;
  const encodedName = encodeURIComponent(name);
  window.open(
    `https://uri.amap.com/navigation?to=${lng},${lat},${encodedName}`,
    "_blank"
  );
}
