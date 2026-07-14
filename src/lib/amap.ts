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
export const DEFAULT_CENTER: [number, number] = [114.3425, 30.5218];
export const DEFAULT_ZOOM = 16;

// ===== 地图设置（localStorage 持久化）=====

const STORAGE_KEY = "villagemap-map-settings";

export interface MapSettings {
  center: [number, number];
  zoom: number;
}

/** 读取地图设置，未配置时返回内置默认值 */
export function getMapSettings(): MapSettings {
  if (typeof window === "undefined") return { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM };
    const parsed = JSON.parse(raw);
    const lng = Number(parsed?.center?.[0]);
    const lat = Number(parsed?.center?.[1]);
    const zoom = Number(parsed?.zoom);
    return {
      center:
        isNaN(lng) || isNaN(lat) ? DEFAULT_CENTER : [lng, lat],
      zoom: isNaN(zoom) ? DEFAULT_ZOOM : zoom,
    };
  } catch {
    return { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM };
  }
}

/** 保存地图设置 */
export function saveMapSettings(settings: MapSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  // 通知其他组件（如地图页）设置已更新
  window.dispatchEvent(new CustomEvent("map-settings-changed"));
}
