"use client";

import { useEffect, useRef, useState } from "react";
import type { Household } from "@/types";
import { getHouseholdColor, tagIconMap } from "@/lib/tags";
import { DEFAULT_CENTER, DEFAULT_ZOOM } from "@/lib/amap";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let AMapInstance: any = null;

export interface RoutePlanParams {
  origin: [number, number];
  destination: [number, number];
  waypoints?: [number, number][];
  mode: "driving" | "walking" | "riding";
  voiceEnabled?: boolean;
  visitCount?: number;
}

interface MapContainerProps {
  households: Household[];
  selectedId: number | null;
  onSelect: (household: Household) => void;
  onMapClick?: (lng: number, lat: number) => void;
  onPickAddress?: (address: string) => void;
  pickingMode?: boolean;
  pickPosition?: { lng: number; lat: number } | null;
  routePlan?: RoutePlanParams | null;
  onRouteComplete?: (info: { distance: string; time: string } | null) => void;
  // 走访模式：到达住户附近自动弹窗
  visitMode?: boolean;
  visitHouseholds?: Household[];
  onArriveHousehold?: (household: Household) => void;
  // 搜索词：变化时触发地图自动缩放到匹配标记（标签筛选不触发）
  searchKey?: string;
}

export function MapContainer({
  households,
  selectedId,
  onSelect,
  onMapClick,
  onPickAddress,
  pickingMode = false,
  pickPosition = null,
  routePlan,
  onRouteComplete,
  visitMode = false,
  visitHouseholds = [],
  onArriveHousehold,
  searchKey,
}: MapContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pickMarkerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const geocoderRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routeLayerRef = useRef<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routePlannerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const geolocationRef = useRef<any>(null);
  // 卫星图层和路网图层引用（用于地图类型切换）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const satelliteLayerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const roadNetLayerRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapType, setMapType] = useState<"standard" | "satellite">("standard");
  // 走访模式：已自动弹窗过的住户ID，防止重复弹窗
  const visitedIdsRef = useRef<Set<number>>(new Set());
  const visitWatchRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onPickAddressRef = useRef(onPickAddress);
  onPickAddressRef.current = onPickAddress;
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;
  const onRouteCompleteRef = useRef(onRouteComplete);
  onRouteCompleteRef.current = onRouteComplete;
  const visitModeRef = useRef(visitMode);
  visitModeRef.current = visitMode;
  const visitHouseholdsRef = useRef<Household[]>(visitHouseholds);
  visitHouseholdsRef.current = visitHouseholds;
  const onArriveHouseholdRef = useRef(onArriveHousehold);
  onArriveHouseholdRef.current = onArriveHousehold;

  // 初始化地图
  useEffect(() => {
    if (!containerRef.current) return;

    import("@amap/amap-jsapi-loader").then((AMapLoader) => {
      window._AMapSecurityConfig = {
        securityJsCode: process.env.NEXT_PUBLIC_AMAP_SECRET!,
      };

      AMapLoader.default.load({
        key: process.env.NEXT_PUBLIC_AMAP_KEY!,
        version: "2.0",
        plugins: [
          "AMap.Scale",
          "AMap.Geolocation",
          "AMap.ControlBar",
          "AMap.Geocoder",
          "AMap.Driving",
          "AMap.Walking",
          "AMap.Riding",
        ],
      })
        .then((AMap: any) => {
          AMap.getConfig().appname = "amap-jsapi-skill";
          AMapInstance = AMap;

          // 初始化时直接定位到当前位置，用默认中心作为兜底
          const map = new AMap.Map(containerRef.current, {
            viewMode: "2D",
            zoom: DEFAULT_ZOOM,
            center: DEFAULT_CENTER,
            mapStyle: "amap://styles/whitesmoke",
          });

          // 比例尺
          map.addControl(new AMap.Scale());

          // 预创建卫星图层和路网图层（默认隐藏，切换时显示）
          satelliteLayerRef.current = new AMap.TileLayer.Satellite();
          roadNetLayerRef.current = new AMap.TileLayer.RoadNet();
          satelliteLayerRef.current.setMap(map);
          roadNetLayerRef.current.setMap(map);
          // 默认隐藏（标准矢量图）
          satelliteLayerRef.current.hide();
          roadNetLayerRef.current.hide();

          // 缩放/旋转/复位控件（右上角）
          map.addControl(
            new AMap.ControlBar({
              position: { right: "10px", top: "10px" },
              showControlButton: true,
            })
          );

          // 初始化逆地理编码
          geocoderRef.current = new AMap.Geocoder({
            extensions: "all",
          });

          // 定位控件（隐藏默认按钮，我们用自定义按钮触发）
          const geolocation = new AMap.Geolocation({
            enableHighAccuracy: true,
            timeout: 10000,
            zoomToAccuracy: true,
            GeoLocationFirst: true,
            showButton: false,
            showMarker: true,
            showCircle: true,
            markerOptions: {
              content: `
                <div class="loc-marker" style="position:relative;width:32px;height:32px;pointer-events:none;">
                  <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:16px;height:16px;border-radius:50%;background:#2f80ed;border:3px solid white;box-shadow:0 0 0 3px rgba(47,128,237,.2),0 2px 6px rgba(0,0,0,.2);"></div>
                  <div style="position:absolute;left:50%;top:2px;transform:translateX(-50%);width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:12px solid #2f80ed;filter:drop-shadow(0 -1px 2px rgba(0,0,0,.2));"></div>
                </div>
              `,
              offset: new AMap.Pixel(-16, -16),
            },
            circleOptions: {
              strokeColor: "#2f80ed",
              strokeOpacity: 0.3,
              strokeWeight: 1,
              fillColor: "#2f80ed",
              fillOpacity: 0.08,
              clickable: false,
              bubble: true,
            },
          });
          map.addControl(geolocation);
          geolocationRef.current = geolocation;
          geolocation.getCurrentPosition();

          geolocation.on("complete", (data: any) => {
            if (data.position) {
              // 立即跳转（无动画），避免遮罩消失后看到从默认位置到当前位置的平移
              map.setZoomAndCenter(
                16,
                [data.position.lng, data.position.lat],
                true
              );

              // 精度太差（>200米，通常是IP定位）时隐藏精度圆，避免视觉干扰
              if (data.accuracy && data.accuracy > 200) {
                geolocation.hideCircle?.();
              } else {
                geolocation.showCircle?.();
              }

              // 走访模式：检测是否到达住户附近（50米内），自动触发走访弹窗
              if (visitModeRef.current && AMapInstance && visitHouseholdsRef.current.length > 0) {
                const currentPos: [number, number] = [data.position.lng, data.position.lat];
                visitHouseholdsRef.current.forEach((h) => {
                  if (visitedIdsRef.current.has(h.id)) return;
                  const lng = Number(h.longitude);
                  const lat = Number(h.latitude);
                  if (isNaN(lng) || isNaN(lat)) return;
                  const dist = AMapInstance.GeometryUtil.distance(currentPos, [lng, lat]);
                  if (dist <= 50) {
                    visitedIdsRef.current.add(h.id);
                    onArriveHouseholdRef.current?.(h);
                  }
                });
              }
            }
            setMapReady(true);
          });

          geolocation.on("error", () => {
            // 定位失败，回退到默认中心
            map.setCenter(DEFAULT_CENTER);
            setMapReady(true);
          });

          // 监听设备朝向，旋转定位蓝点
          const handleOrientation = (e: DeviceOrientationEvent) => {
            const heading = e.alpha; // 0-360
            if (heading !== null) {
              const marker = document.querySelector(".loc-marker") as HTMLElement;
              if (marker) {
                marker.style.transform = `rotate(${Math.round(heading)}deg)`;
                marker.style.transition = "transform 0.3s ease";
              }
            }
          };
          if (window.DeviceOrientationEvent) {
            // iOS 13+ 需要请求权限
            if (typeof (DeviceOrientationEvent as any).requestPermission === "function") {
              // 需要用户手势触发，这里先不请求，在定位按钮点击时请求
            } else {
              window.addEventListener("deviceorientation", handleOrientation);
            }
          }

          map.on("click", (e: any) => {
            const lng = e.lnglat.getLng();
            const lat = e.lnglat.getLat();

            if (onMapClickRef.current) {
              onMapClickRef.current(lng, lat);
            }

            // 选点模式下自动逆地理编码填充地址
            if (geocoderRef.current && onPickAddressRef.current) {
              geocoderRef.current.getAddress(
                [lng, lat],
                (status: string, result: any) => {
                  if (status === "complete" && result.info === "OK") {
                    onPickAddressRef.current!(
                      result.regeocode.formattedAddress
                    );
                  }
                }
              );
            }
          });

          mapRef.current = map;
        })
        .catch((e: Error) => {
          console.error("地图加载失败", e);
        });
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 更新住户标记
  useEffect(() => {
    if (!mapRef.current || !AMapInstance) return;
    const AMap = AMapInstance;
    const map = mapRef.current;

    // 清除旧标记
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    households.forEach((family) => {
      const lng = Number(family.longitude);
      const lat = Number(family.latitude);
      if (isNaN(lng) || isNaN(lat)) return;

      const tags = Array.isArray(family.tags) ? family.tags : [];
      const mainColor = getHouseholdColor(tags);
      const isSelected = selectedId === family.id;
      const tagCount = tags.length;

      const firstTag = tags[0] || "脱贫户";
      const iconPath = tagIconMap[firstTag] || tagIconMap["脱贫户"];

      const markerContent = `
        <div style="position:relative;cursor:pointer;" class="${isSelected ? "marker-selected" : ""}">
          ${isSelected ? `<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:46px;height:46px;border-radius:50%;background:${mainColor}33;animation:ping 1.8s infinite;"></div>` : ""}
          <div style="position:relative;z-index:2;display:grid;place-items:center;width:36px;height:36px;border:3px solid white;border-radius:50%;background:${mainColor};box-shadow:0 3px 10px ${mainColor}55;transition:transform .2s;${isSelected ? "transform:scale(1.15);" : ""}overflow:hidden;">
            ${family.lastVisitImage
              ? `<img src="${family.lastVisitImage}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.style.display='none';this.parentElement.innerHTML='<svg width=\\'18\\' height=\\'18\\' viewBox=\\'0 0 24 24\\' fill=\\'white\\'><path d=\\'${iconPath}\\'/></svg>';" />`
              : `<svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="${iconPath}"/></svg>`
            }
          </div>
          ${tagCount > 1 ? `<div style="position:absolute;top:-4px;right:-4px;z-index:3;width:18px;height:18px;border-radius:50%;background:${isSelected ? "#2f80ed" : "#EB5757"};color:white;font-size:10px;font-weight:bold;display:grid;place-items:center;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.2);">${tagCount}</div>` : ""}
          ${isSelected ? `<div style="position:absolute;top:-28px;left:50%;transform:translateX(-50%);padding:4px 8px;border-radius:6px;color:#2b405b;background:white;box-shadow:0 3px 10px rgba(34,55,75,.17);font-size:11px;font-weight:bold;white-space:nowrap;">${family.householdName}</div>` : ""}
        </div>
      `;

      const marker = new AMap.Marker({
        position: [lng, lat],
        content: markerContent,
        offset: new AMap.Pixel(-18, -18),
        extData: { id: family.id },
      });

      marker.on("click", () => {
        onSelect(family);
      });

      marker.setMap(map);
      markersRef.current.push(marker);
    });

    // 标记渲染后不主动调整视野，避免标签筛选导致缩放
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [households, selectedId, onSelect, mapReady]);

  // 搜索词变化时：自动缩放定位到匹配的标记（标签筛选不触发此效果）
  useEffect(() => {
    if (!mapRef.current || !searchKey) return;
    // 等待标记渲染完成后再调整视野
    const timer = setTimeout(() => {
      if (markersRef.current.length > 0 && mapRef.current) {
        mapRef.current.setFitView(markersRef.current, false, [60, 60, 60, 60]);
      }
    }, 50);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchKey]);

  // 选点模式标记
  useEffect(() => {
    if (!mapRef.current || !AMapInstance) return;
    const AMap = AMapInstance;

    if (pickMarkerRef.current) {
      pickMarkerRef.current.setMap(null);
      pickMarkerRef.current = null;
    }

    if (pickingMode && pickPosition) {
      const marker = new AMap.Marker({
        position: [pickPosition.lng, pickPosition.lat],
        content: `
          <div style="position:relative;">
            <div style="width:20px;height:20px;border-radius:50%;background:#2f80ed;border:3px solid white;box-shadow:0 2px 8px rgba(47,128,237,.4);"></div>
          </div>
        `,
        offset: new AMap.Pixel(-10, -10),
      });
      marker.setMap(mapRef.current);
      pickMarkerRef.current = marker;
    }
  }, [pickingMode, pickPosition]);

  // 路线规划：在主地图上绘制
  useEffect(() => {
    if (!mapRef.current || !AMapInstance || !routePlan) return;
    const AMap = AMapInstance;
    const map = mapRef.current;

    // 清除之前的路线覆盖物
    routeLayerRef.current.forEach((item) => {
      if (item.setMap) item.setMap(null);
      else if (item.hide) item.hide();
    });
    routeLayerRef.current = [];
    if (routePlannerRef.current) {
      routePlannerRef.current.clear();
      routePlannerRef.current = null;
    }

    const { origin, destination, waypoints, mode } = routePlan;

    // 起点标记
    const startMarker = new AMap.Marker({
      position: origin,
      content: `
        <div style="display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:#27ae60;border:3px solid white;box-shadow:0 2px 8px rgba(39,174,96,.4);color:white;font-size:12px;font-weight:bold;">起</div>
      `,
      offset: new AMap.Pixel(-14, -14),
      zIndex: 120,
    });
    startMarker.setMap(map);
    routeLayerRef.current.push(startMarker);

    // 终点标记
    const endMarker = new AMap.Marker({
      position: destination,
      content: `
        <div style="display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:#eb5757;border:3px solid white;box-shadow:0 2px 8px rgba(235,87,87,.4);color:white;font-size:12px;font-weight:bold;">终</div>
      `,
      offset: new AMap.Pixel(-14, -14),
      zIndex: 120,
    });
    endMarker.setMap(map);
    routeLayerRef.current.push(endMarker);

    const onComplete = (status: string, result: any) => {
      if (status === "complete" && result.routes && result.routes.length > 0) {
        const route = result.routes[0];

        let path: any[] = [];
        // 收集导航步骤的 instruction
        const instructions: string[] = [];

        if (mode === "riding" && route.rides) {
          route.rides.forEach((ride: any) => path.push(...ride.path));
        } else if (route.steps) {
          route.steps.forEach((step: any) => {
            path.push(...step.path);
            if (step.instruction) {
              instructions.push(step.instruction);
            }
          });
        }

        if (path.length > 0) {
          const shadowLine = new AMap.Polyline({
            path,
            strokeColor: mode === "driving" ? "#1a5fb4" : mode === "walking" ? "#1a7a3a" : "#b35c00",
            strokeWeight: 10,
            strokeOpacity: 0.3,
            lineJoin: "round",
            lineCap: "round",
          });
          shadowLine.setMap(map);
          routeLayerRef.current.push(shadowLine);

          const mainColor =
            mode === "driving" ? "#2f80ed" : mode === "walking" ? "#27ae60" : "#f2994a";
          const mainLine = new AMap.Polyline({
            path,
            strokeColor: mainColor,
            strokeWeight: 6,
            strokeOpacity: 0.9,
            lineJoin: "round",
            lineCap: "round",
            showDir: true,
          });
          mainLine.setMap(map);
          routeLayerRef.current.push(mainLine);

          map.setFitView([mainLine], false, [80, 80, 80, 80]);
        }

        const distance =
          route.distance >= 1000
            ? (route.distance / 1000).toFixed(1) + " 公里"
            : Math.round(route.distance) + " 米";
        const minutes = Math.round(route.time / 60);
        const time =
          minutes >= 60
            ? `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟`
            : `${minutes} 分钟`;
        onRouteCompleteRef.current?.({ distance, time });

        // 语音播报：只播报路线概况，不播报具体步骤
        if (routePlan.voiceEnabled && typeof window !== "undefined" && "speechSynthesis" in window) {
          const overview = `路线规划完成，全程${distance}，预计${time}，共走访${routePlan.visitCount || 0}户。`;
          const utterOverview = new SpeechSynthesisUtterance(overview);
          utterOverview.lang = "zh-CN";
          utterOverview.rate = 1.1;
          window.speechSynthesis.speak(utterOverview);
        }

        // 保存导航步骤到 window 供导航面板使用
        (window as any).__navSteps = instructions;
        (window as any).__navDistance = distance;
        (window as any).__navTime = time;
        // 触发自定义事件通知页面更新导航面板
        window.dispatchEvent(new CustomEvent("nav-ready", {
          detail: { steps: instructions, distance, time },
        }));
      } else {
        onRouteCompleteRef.current?.({ distance: "规划失败", time: "—" });
      }
    };

    if (mode === "driving") {
      const driving = new AMap.Driving({
        policy: AMap.DrivingPolicy.LEAST_TIME,
        map: null,
      });
      routePlannerRef.current = driving;
      if (waypoints && waypoints.length > 0) {
        driving.search(origin, destination, { waypoints }, onComplete);
      } else {
        driving.search(origin, destination, onComplete);
      }
    } else if (mode === "walking") {
      const walking = new AMap.Walking({});
      routePlannerRef.current = walking;
      walking.search(origin, destination, onComplete);
    } else {
      const riding = new AMap.Riding({});
      routePlannerRef.current = riding;
      riding.search(origin, destination, onComplete);
    }
  }, [routePlan]);

  // 清除路线
  useEffect(() => {
    if (!routePlan && routeLayerRef.current.length > 0 && mapRef.current) {
      routeLayerRef.current.forEach((item) => {
        if (item.setMap) item.setMap(null);
      });
      routeLayerRef.current = [];
      if (routePlannerRef.current) {
        routePlannerRef.current.clear();
        routePlannerRef.current = null;
      }
    }
    // 路线清除时重置已访问住户集合
    if (!routePlan) {
      visitedIdsRef.current.clear();
    }
  }, [routePlan]);

  // 走访模式：周期性定位检测是否到达住户附近
  useEffect(() => {
    if (visitMode && geolocationRef.current) {
      // 立即定位一次
      geolocationRef.current.getCurrentPosition();
      // 每10秒定位一次
      visitWatchRef.current = setInterval(() => {
        geolocationRef.current?.getCurrentPosition();
      }, 10000);
    }
    return () => {
      if (visitWatchRef.current) {
        clearInterval(visitWatchRef.current);
        visitWatchRef.current = null;
      }
    };
  }, [visitMode]);

  // 定位到当前位置
  const handleLocate = () => {
    if (geolocationRef.current) {
      geolocationRef.current.getCurrentPosition();
    }
  };

  // 切换地图类型：标准矢量图 / 卫星图（带路网）
  const handleToggleMapType = () => {
    const next = mapType === "standard" ? "satellite" : "standard";
    setMapType(next);
    if (next === "satellite") {
      satelliteLayerRef.current?.show();
      roadNetLayerRef.current?.show();
    } else {
      satelliteLayerRef.current?.hide();
      roadNetLayerRef.current?.hide();
    }
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div
        ref={containerRef}
        id="amap-container"
        style={{ width: "100%", height: "100%", minHeight: "480px" }}
      />
      {!mapReady && (
        <div style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          color: "#8a95a8",
          fontSize: 14,
          background: "#f7f9fc",
          zIndex: 50,
          transition: "opacity 0.3s ease",
        }}>
          定位中...
        </div>
      )}
      {/* 自定义定位按钮 */}
      <button
        className="map-locate-btn"
        onClick={handleLocate}
        title="定位到当前位置"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2f80ed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
        </svg>
      </button>
      {/* 地图类型切换按钮：标准 / 卫星 */}
      <button
        className="map-type-btn"
        onClick={handleToggleMapType}
        title={mapType === "standard" ? "切换到卫星图" : "切换到标准图"}
      >
        {mapType === "standard" ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2f80ed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#27ae60" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
        )}
      </button>
    </div>
  );
}
