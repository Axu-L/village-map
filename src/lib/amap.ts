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
