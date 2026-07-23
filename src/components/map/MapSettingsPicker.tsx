"use client";

import { useEffect, useRef, useState } from "react";
import { Save, RotateCcw, MapPin, Check } from "lucide-react";
import {
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  getMapConfig,
  saveMapConfig,
} from "@/lib/amap";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let AMapInstance: any = null;

export function MapSettingsPicker() {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const geocoderRef = useRef<any>(null);

  // 初始读取已保存的配置（默认值兜底）
  const initial = getMapConfig();
  const [lng, setLng] = useState<string>(initial.center[0].toFixed(6));
  const [lat, setLat] = useState<string>(initial.center[1].toFixed(6));
  const [address, setAddress] = useState<string>("");
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  // 初始化小地图
  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;

    import("@amap/amap-jsapi-loader").then((AMapLoader) => {
      if (cancelled) return;
      window._AMapSecurityConfig = {
        securityJsCode: process.env.NEXT_PUBLIC_AMAP_SECRET!,
      };

      AMapLoader.default.load({
        key: process.env.NEXT_PUBLIC_AMAP_KEY!,
        version: "2.0",
        plugins: ["AMap.Geocoder"],
      })
        .then((AMap: any) => {
          if (cancelled || !containerRef.current) return;
          AMapInstance = AMap;

          const cfg = getMapConfig();
          const map = new AMap.Map(containerRef.current, {
            viewMode: "2D",
            zoom: DEFAULT_ZOOM,
            center: cfg.center,
            mapStyle: "amap://styles/whitesmoke",
          });
          mapRef.current = map;

          // 逆地理编码
          geocoderRef.current = new AMap.Geocoder({ extensions: "all" });

          // 中心点标记（可拖动）
          const marker = new AMap.Marker({
            position: cfg.center,
            draggable: true,
            cursor: "move",
            content: `<div style="position:relative;width:24px;height:24px;">
              <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:18px;height:18px;border-radius:50%;background:#e74c3c;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.3);"></div>
            </div>`,
            offset: new AMap.Pixel(-12, -12),
          });
          marker.on("dragging", (e: any) => {
            const pos = e.lnglat || marker.getPosition();
            updatePosition(pos.getLng(), pos.getLat());
          });
          map.add(marker);
          markerRef.current = marker;

          // 点击地图移动标记
          map.on("click", (e: any) => {
            const pos = e.lnglat;
            marker.setPosition(pos);
            updatePosition(pos.getLng(), pos.getLat());
          });

          // 首次逆地理编码当前中心
          reverseGeocode(cfg.center[0], cfg.center[1]);
          setMapReady(true);
        })
        .catch((e: Error) => {
          console.error("地图加载失败", e);
        });
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 更新坐标并标记为已修改
  const updatePosition = (newLng: number, newLat: number) => {
    setLng(newLng.toFixed(6));
    setLat(newLat.toFixed(6));
    setDirty(true);
    setSaved(false);
    reverseGeocode(newLng, newLat);
  };

  // 逆地理编码
  const reverseGeocode = (lngVal: number, latVal: number) => {
    if (!geocoderRef.current) return;
    geocoderRef.current.getAddress(
      [lngVal, latVal],
      (status: string, result: any) => {
        if (status === "complete" && result?.info === "OK") {
          setAddress(result.regeocode?.formattedAddress || "");
        } else {
          setAddress("");
        }
      }
    );
  };

  // 手动输入坐标后，把标记移到新位置
  const handleManualInput = () => {
    const lngNum = parseFloat(lng);
    const latNum = parseFloat(lat);
    if (
      isNaN(lngNum) ||
      isNaN(latNum) ||
      lngNum < -180 ||
      lngNum > 180 ||
      latNum < -90 ||
      latNum > 90
    ) {
      return;
    }
    if (mapRef.current && markerRef.current && AMapInstance) {
      markerRef.current.setPosition([lngNum, latNum]);
      mapRef.current.setCenter([lngNum, latNum]);
      setDirty(true);
      setSaved(false);
      reverseGeocode(lngNum, latNum);
    }
  };

  // 保存
  const handleSave = () => {
    const lngNum = parseFloat(lng);
    const latNum = parseFloat(lat);
    if (isNaN(lngNum) || isNaN(latNum)) {
      alert("坐标格式不正确");
      return;
    }
    saveMapConfig({ center: [lngNum, latNum], zoom: DEFAULT_ZOOM });
    setDirty(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // 重置为默认
  const handleReset = () => {
    setLng(DEFAULT_CENTER[0].toFixed(6));
    setLat(DEFAULT_CENTER[1].toFixed(6));
    if (mapRef.current && markerRef.current && AMapInstance) {
      markerRef.current.setPosition(DEFAULT_CENTER);
      mapRef.current.setCenter(DEFAULT_CENTER);
    }
    reverseGeocode(DEFAULT_CENTER[0], DEFAULT_CENTER[1]);
    setDirty(true);
    setSaved(false);
  };

  return (
    <div>
      {/* 内嵌小地图 */}
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: 240,
          borderRadius: 10,
          overflow: "hidden",
          background: "#eef2e9",
          marginBottom: 14,
        }}
      />
      {!mapReady && (
        <div
          style={{
            textAlign: "center",
            color: "#8a95a8",
            fontSize: 12,
            marginBottom: 12,
          }}
        >
          地图加载中...
        </div>
      )}

      {/* 坐标输入 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div>
          <label
            style={{
              display: "block",
              fontSize: 12,
              color: "#8a95a8",
              marginBottom: 4,
            }}
          >
            经度 (lng)
          </label>
          <input
            type="text"
            value={lng}
            onChange={(e) => {
              setLng(e.target.value);
              setDirty(true);
              setSaved(false);
            }}
            onBlur={handleManualInput}
            style={{
              width: "100%",
              padding: "8px 10px",
              border: "1px solid #e1e7ee",
              borderRadius: 7,
              fontSize: 13,
              outline: "none",
              color: "#2b405b",
              background: "#fff",
              boxSizing: "border-box",
              fontFamily: "monospace",
            }}
          />
        </div>
        <div>
          <label
            style={{
              display: "block",
              fontSize: 12,
              color: "#8a95a8",
              marginBottom: 4,
            }}
          >
            纬度 (lat)
          </label>
          <input
            type="text"
            value={lat}
            onChange={(e) => {
              setLat(e.target.value);
              setDirty(true);
              setSaved(false);
            }}
            onBlur={handleManualInput}
            style={{
              width: "100%",
              padding: "8px 10px",
              border: "1px solid #e1e7ee",
              borderRadius: 7,
              fontSize: 13,
              outline: "none",
              color: "#2b405b",
              background: "#fff",
              boxSizing: "border-box",
              fontFamily: "monospace",
            }}
          />
        </div>
      </div>

      {/* 地址 */}
      {address && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 12px",
            marginBottom: 12,
            background: "#f9fbfd",
            borderRadius: 7,
            fontSize: 12,
            color: "#5a6577",
          }}
        >
          <MapPin size={13} color="#2f80ed" />
          {address}
        </div>
      )}

      {/* 操作提示 */}
      <div
        style={{
          fontSize: 12,
          color: "#8a95a8",
          marginBottom: 14,
          lineHeight: 1.5,
        }}
      >
        点击或拖动地图上的红色标记选择默认中心点，也可手动输入坐标。保存后地图页将以此为中心打开。
      </div>

      {/* 按钮 */}
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={handleSave}
          disabled={!dirty}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "9px 20px",
            border: "none",
            borderRadius: 8,
            background: dirty ? "#2f80ed" : "#c0c8d4",
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            cursor: dirty ? "pointer" : "not-allowed",
          }}
        >
          {saved ? <Check size={15} /> : <Save size={15} />}
          {saved ? "已保存" : "保存设置"}
        </button>
        <button
          onClick={handleReset}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "9px 16px",
            border: "1px solid #e1e7ee",
            borderRadius: 8,
            background: "#fff",
            color: "#5a6577",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <RotateCcw size={15} />
          恢复默认
        </button>
      </div>
    </div>
  );
}
