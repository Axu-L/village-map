// eslint-disable-next-line @typescript-eslint/no-explicit-any
let amapPromise: Promise<any> | null = null;
const loadedPlugins = new Set<string>();

/**
 * 统一的 AMap 加载入口，供 MapContainer / MapSettingsPicker / RoutePlan / Topbar 复用
 * 单例缓存：首次调用加载 SDK + 指定插件；后续调用若请求新插件则动态补加载
 * @param plugins 需要预加载的插件列表
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function initAMap(plugins: string[] = []): Promise<any> {
  // 已有实例：检查是否需要补加载新插件
  if (amapPromise) {
    const missing = plugins.filter((p) => !loadedPlugins.has(p));
    if (missing.length === 0) return amapPromise;
    missing.forEach((p) => loadedPlugins.add(p));
    // 在 AMap 就绪后通过 AMap.plugin() 动态加载缺失插件
    amapPromise = amapPromise.then(
      (AMap) =>
        new Promise((resolve) => {
          AMap.plugin(missing, () => resolve(AMap));
        })
    );
    return amapPromise;
  }

  // 首次调用：记录插件并加载 SDK
  plugins.forEach((p) => loadedPlugins.add(p));

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
      plugins,
    });
  }).then((AMap: any) => {
    // 埋点：设置应用标识（强制）
    AMap.getConfig().appname = "amap-jsapi-skill";
    return AMap;
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

/**
 * 强制修正高德 logo / 版权 / 比例尺位置
 * 高德 SDK 运行时注入的 <style> 会覆盖 globals.css 的 !important 规则，
 * 这里用内联 style（优先级最高）兜底，确保控件锚定到容器左下角，且互不重叠。
 * 所有创建 AMap.Map 的组件（MapContainer / MapSettingsPicker 等）都应在地图初始化后调用。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fixAmapControls(map: any): void {
  if (typeof document === "undefined" || !map) return;
  // map.getContainer() 返回地图根容器
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const root: HTMLElement | null = map.getContainer?.() as any;
  if (!root) return;
  const apply = (sel: string, props: Record<string, string>) => {
    const el = root.querySelector(sel) as HTMLElement | null;
    if (!el) return;
    Object.entries(props).forEach(([k, v]) =>
      el.style.setProperty(k, v, "important")
    );
  };
  apply(".amap-logo", {
    left: "6px",
    bottom: "2px",
    right: "auto",
    top: "auto",
    "z-index": "2",
  });
  apply(".amap-copyright", {
    right: "6px",
    bottom: "2px",
    left: "auto",
    top: "auto",
    "z-index": "2",
  });
  apply(".amap-scalecontrol", {
    left: "6px",
    bottom: "30px",
    top: "auto",
    "z-index": "2",
  });
}
