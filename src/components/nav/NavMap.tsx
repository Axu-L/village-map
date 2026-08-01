"use client";

import { useEffect, useRef, useState } from "react";
import type { Household, NavRouteParams } from "@/types";
import { getHouseholdColor } from "@/lib/tags";
import { initAMap, DEFAULT_CENTER, DEFAULT_ZOOM } from "@/lib/amap";
import { GEOLOCATION_INTERVAL, VISIT_ARRIVE_THRESHOLD } from "@/lib/constants";

interface NavMapProps {
  params: NavRouteParams;
  households: Household[];
  visitMode?: boolean;
  onRouteInfo?: (info: { distance: string; time: string; steps: string[] }) => void;
  onArriveHousehold?: (h: Household) => void;
}

export function NavMap({
  params,
  households,
  visitMode,
  onRouteInfo,
  onArriveHousehold,
}: NavMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const AMapRef = useRef<any>(null);
  const routeLayerRef = useRef<{ setMap?: (m: null) => void; hide?: () => void }[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routePlannerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const geolocationRef = useRef<any>(null);
  const visitWatchRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const visitedIdsRef = useRef<Set<number>>(new Set());
  const onRouteInfoRef = useRef(onRouteInfo);
  const onArriveRef = useRef(onArriveHousehold);
  const [mapReady, setMapReady] = useState(false);
  const [locating, setLocating] = useState(params.origin === null);

  useEffect(() => {
    onRouteInfoRef.current = onRouteInfo;
    onArriveRef.current = onArriveHousehold;
  });

  // 初始化地图 + 绘制住户标记
  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    initAMap([
      "AMap.Scale",
      "AMap.Geolocation",
      "AMap.ControlBar",
      "AMap.Geocoder",
      "AMap.Driving",
      "AMap.Walking",
      "AMap.Riding",
    ]).then((AMap) => {
      if (cancelled || !containerRef.current) return;
      AMapRef.current = AMap;

      const map = new AMap.Map(containerRef.current, {
        viewMode: "2D",
        zoom: DEFAULT_ZOOM,
        center: DEFAULT_CENTER,
        mapStyle: "amap://styles/whitesmoke",
      });
      map.addControl(new AMap.Scale());
      map.addControl(
        new AMap.ControlBar({
          position: { right: "10px", top: "10px" },
          showControlButton: true,
        })
      );
      mapRef.current = map;
      setMapReady(true);

      // 隐藏定位控件默认按钮，用自定义逻辑触发
      const geolocation = new AMap.Geolocation({
        enableHighAccuracy: true,
        timeout: GEOLOCATION_INTERVAL,
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

      // 绘制走访住户标记（编号 + 标签主色）
      households.forEach((h, idx) => {
        const lng = Number(h.longitude);
        const lat = Number(h.latitude);
        if (isNaN(lng) || isNaN(lat) || (lng === 0 && lat === 0)) return;
        const mainColor = getHouseholdColor(h.tags);
        const marker = new AMap.Marker({
          position: [lng, lat],
          content: `
            <div style="position:relative;z-index:2;display:grid;place-items:center;width:36px;height:36px;border:3px solid white;border-radius:50%;background:${mainColor};box-shadow:0 3px 10px ${mainColor}55;">
              <span style="color:white;font-size:13px;font-weight:bold;">${idx + 1}</span>
            </div>
          `,
          offset: new AMap.Pixel(-18, -18),
          zIndex: 120,
        });
        marker.setMap(map);
        routeLayerRef.current.push(marker);
      });

      // 若起点已提供（来自 RoutePlan），直接绘制路线；否则先定位
      if (params.origin) {
        drawRoute(params.origin);
      } else {
        locateAndDraw();
      }
    });

    function locateAndDraw() {
      const AMap = AMapRef.current;
      const geo = geolocationRef.current;
      if (!AMap || !geo) return;

      let resolved = false;
      const useDefault = () => {
        if (resolved) return;
        resolved = true;
        setLocating(false);
        drawRoute(DEFAULT_CENTER);
      };

      // iOS 非安全上下文兜底：6 秒后回退默认位置
      const timer = setTimeout(useDefault, 6000);

      geo.getCurrentPosition();
      geo.on("complete", (data: { position: { getLng: () => number; getLat: () => number } }) => {
        if (resolved || !data?.position) return;
        resolved = true;
        clearTimeout(timer);
        setLocating(false);
        const lng = data.position.getLng();
        const lat = data.position.getLat();
        drawRoute([lng, lat]);
      });
      geo.on("error", () => {
        clearTimeout(timer);
        useDefault();
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function drawRoute(origin: [number, number]) {
      const AMap = AMapRef.current;
      const map = mapRef.current;
      if (!AMap || !map) return;

      const { destination, waypoints, mode } = params;

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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const onComplete = (status: string, result: any) => {
        if (status !== "complete" || !result.routes || result.routes.length === 0) {
          onRouteInfoRef.current?.({ distance: "规划失败", time: "—", steps: [] });
          return;
        }
        const route = result.routes[0];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let path: any[] = [];
        const instructions: string[] = [];

        if (mode === "riding" && route.rides) {
          route.rides.forEach((ride: { path: any[] }) => path.push(...ride.path));
        } else if (route.steps) {
          route.steps.forEach((step: { path: any[]; instruction?: string }) => {
            path.push(...step.path);
            if (step.instruction) instructions.push(step.instruction);
          });
        }

        if (path.length > 0) {
          const shadowLine = new AMap.Polyline({
            path,
            strokeColor:
              mode === "driving" ? "#1a5fb4" : mode === "walking" ? "#1a7a3a" : "#b35c00",
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

          map.setFitView([mainLine], false, [80, 80, 120, 80]);
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

        onRouteInfoRef.current?.({ distance, time, steps: instructions });

        if (params.voiceEnabled && typeof window !== "undefined" && "speechSynthesis" in window) {
          const overview = `路线规划完成，全程${distance}，预计${time}，共走访${params.visitCount || 0}户。`;
          const utter = new SpeechSynthesisUtterance(overview);
          utter.lang = "zh-CN";
          utter.rate = 1.1;
          window.speechSynthesis.speak(utter);
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
    }

    return () => {
      cancelled = true;
      if (visitWatchRef.current) {
        clearInterval(visitWatchRef.current);
        visitWatchRef.current = null;
      }
      routeLayerRef.current.forEach((item) => {
        if (item.setMap) item.setMap(null);
      });
      routeLayerRef.current = [];
      if (routePlannerRef.current) {
        routePlannerRef.current.clear();
        routePlannerRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 走访模式：周期性定位检测是否到达住户附近
  useEffect(() => {
    if (!visitMode || !geolocationRef.current) return;
    geolocationRef.current.getCurrentPosition();
    visitWatchRef.current = setInterval(() => {
      geolocationRef.current?.getCurrentPosition();
    }, GEOLOCATION_INTERVAL);

    const onLocate = (data: { position: { getLng: () => number; getLat: () => number } }) => {
      if (!data?.position) return;
      const lng = data.position.getLng();
      const lat = data.position.getLat();
      households.forEach((h) => {
        if (visitedIdsRef.current.has(h.id)) return;
        const hLng = Number(h.longitude);
        const hLat = Number(h.latitude);
        if (isNaN(hLng) || isNaN(hLat)) return;
        const dist = AMapRef.current?.GeometryUtil?.distance(
          [lng, lat],
          [hLng, hLat]
        );
        if (dist != null && dist <= VISIT_ARRIVE_THRESHOLD) {
          visitedIdsRef.current.add(h.id);
          onArriveRef.current?.(h);
        }
      });
    };
    geolocationRef.current.on("complete", onLocate);

    return () => {
      if (visitWatchRef.current) {
        clearInterval(visitWatchRef.current);
        visitWatchRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitMode]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div
        ref={containerRef}
        id="nav-amap-container"
        style={{ width: "100%", height: "100%", minHeight: "100%" }}
      />
      {!mapReady && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            color: "#8a95a8",
            fontSize: 14,
            background: "#f7f9fc",
            zIndex: 50,
          }}
        >
          地图加载中...
        </div>
      )}
      {locating && mapReady && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 16,
            transform: "translateX(-50%)",
            zIndex: 60,
            padding: "8px 16px",
            borderRadius: 20,
            background: "rgba(47,128,237,0.92)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            boxShadow: "0 4px 12px rgba(47,128,237,0.3)",
          }}
        >
          正在定位当前位置...
        </div>
      )}
    </div>
  );
}
