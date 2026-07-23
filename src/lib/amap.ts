let amapPromise: Promise<any> | null = null;

export function initAMap() {
  if (amapPromise) return amapPromise;

  // 设置安全密钥（必须在加载地图之前）
  if (typeof window !== "undefined") {
    window._AMapSecurityConfig = {
      securityJsCode: process.env.NEXT_PUBLIC_AMAP_SECRET!,
    };
  }

  // 动态导入，避免 SSR 报错
  amapPromise = import("@amap/amap-jsapi-loader").then((mod) => {
    return mod.default.load({
      key: process.env.NEXT_PUBLIC_AMAP_KEY!,
      version: "2.0",
      plugins: ["AMap.Scale", "AMap.ToolBar"],
    });
  });

  return amapPromise;
}

// 花园村默认中心点（高德格式 [lng, lat]，6位小数≈0.1米精度）
// 这是兜底值；用户在「设置」页保存的自定义中心会覆盖它
export const DEFAULT_CENTER: [number, number] = [114.3425, 30.5218];
export const DEFAULT_ZOOM = 16;

// localStorage key：用户自定义地图配置
const MAP_CONFIG_KEY = "mapConfig";

export interface MapConfig {
  center: [number, number];
  zoom: number;
}

/**
 * 读取用户在设置页保存的地图配置；未保存时返回默认值。
 * 仅在客户端调用，SSR 时返回默认值。
 */
export function getMapConfig(): MapConfig {
  if (typeof window === "undefined") {
    return { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM };
  }
  try {
    const raw = localStorage.getItem(MAP_CONFIG_KEY);
    if (!raw) return { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM };
    const parsed = JSON.parse(raw) as Partial<MapConfig>;
    const center =
      Array.isArray(parsed.center) &&
      parsed.center.length === 2 &&
      Number.isFinite(parsed.center[0]) &&
      Number.isFinite(parsed.center[1])
        ? ([Number(parsed.center[0]), Number(parsed.center[1])] as [number, number])
        : DEFAULT_CENTER;
    const zoom =
      typeof parsed.zoom === "number" && Number.isFinite(parsed.zoom)
        ? parsed.zoom
        : DEFAULT_ZOOM;
    return { center, zoom };
  } catch {
    return { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM };
  }
}

/** 保存用户自定义地图配置 */
export function saveMapConfig(config: MapConfig): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(MAP_CONFIG_KEY, JSON.stringify(config));
  // 通知其他已打开的页面（如地图页）刷新配置
  window.dispatchEvent(new CustomEvent("map-config-changed"));
}
