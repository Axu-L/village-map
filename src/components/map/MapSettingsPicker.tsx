"use client";

import { useEffect, useRef, useState } from "react";
import { getMapSettings, saveMapSettings, DEFAULT_CENTER, DEFAULT_ZOOM, initAMap } from "@/lib/amap";
import { useToast } from "@/components/ui/Toast";
import { LocateFixed, Save, MapPin, RotateCcw } from "lucide-react";

/**
 * 地图默认中心点选点器
 * - 点击地图选取中心位置
 * - 支持"使用当前位置"浏览器定位
 * - 缩放级别滑块
 * - 保存后通过事件通知地图实时更新
 */
export function MapSettingsPicker() {
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const geocoderRef = useRef<any>(null);

  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [address, setAddress] = useState("");
  const [locating, setLocating] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  // 初始化地图
  useEffect(() => {
    if (!containerRef.current) return;

    const settings = getMapSettings();
    setCenter(settings.center);
    setZoom(settings.zoom);

    let cancelled = false;

    initAMap(["AMap.Geocoder", "AMap.Geolocation"])
      .then((AMap: any) => {
        if (cancelled) return;

        const map = new AMap.Map(containerRef.current, {
          viewMode: "2D",
          zoom: settings.zoom,
          center: settings.center,
          mapStyle: "amap://styles/whitesmoke",
        });

        geocoderRef.current = new AMap.Geocoder({ extensions: "all" });

        // 初始标记
        markerRef.current = new AMap.Marker({
          position: settings.center,
          content: `<div style="position:relative;width:36px;height:36px;">
            <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:20px;height:20px;border-radius:50%;background:#e74c3c;border:4px solid white;box-shadow:0 0 0 3px rgba(231,76,60,.2),0 3px 8px rgba(0,0,0,.25);"></div>
          </div>`,
          offset: new AMap.Pixel(-18, -18),
          draggable: true,
          cursor: "move",
        });
        markerRef.current.setMap(map);

        // 拖动标记结束后更新坐标
        markerRef.current.on("dragging", () => {
          const pos = markerRef.current.getPosition();
          setCenter([pos.getLng(), pos.getLat()]);
        });
        markerRef.current.on("dragend", () => {
          const pos = markerRef.current.getPosition();
          reverseGeocode(pos.getLng(), pos.getLat());
        });

        // 点击地图移动标记
        map.on("click", (e: any) => {
          const lng = e.lnglat.getLng();
          const lat = e.lnglat.getLat();
          markerRef.current.setPosition([lng, lat]);
          setCenter([lng, lat]);
          reverseGeocode(lng, lat);
        });

        mapRef.current = map;
        setMapReady(true);

        // 初始逆地理编码
        reverseGeocode(settings.center[0], settings.center[1]);
      })
      .catch((e: Error) => {
        console.error("地图加载失败", e);
      });

    function reverseGeocode(lng: number, lat: number) {
      if (!geocoderRef.current) return;
      geocoderRef.current.getAddress(
        [lng, lat],
        (status: string, result: any) => {
          if (status === "complete" && result.info === "OK") {
            setAddress(result.regeocode.formattedAddress);
          }
        }
      );
    }

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
    };
  }, []);

  // 缩放级别变化时同步到地图
  const handleZoomChange = (value: number) => {
    setZoom(value);
    if (mapRef.current) {
      mapRef.current.setZoom(value);
    }
  };

  // 使用当前位置
  const handleLocate = () => {
    if (!navigator.geolocation) {
      toast("浏览器不支持定位功能", "error");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lng = pos.coords.longitude;
        const lat = pos.coords.latitude;
        setCenter([lng, lat]);
        if (mapRef.current && markerRef.current) {
          mapRef.current.setZoomAndCenter(zoom, [lng, lat]);
          markerRef.current.setPosition([lng, lat]);
        }
        setLocating(false);
        toast("已定位到当前位置", "success");
        // 逆地理编码
        if (geocoderRef.current) {
          geocoderRef.current.getAddress(
            [lng, lat],
            (status: string, result: any) => {
              if (status === "complete" && result.info === "OK") {
                setAddress(result.regeocode.formattedAddress);
              }
            }
          );
        }
      },
      (err) => {
        setLocating(false);
        toast(`定位失败：${err.message}`, "error");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // 保存设置
  const handleSave = () => {
    saveMapSettings({ center, zoom });
    toast("地图设置已保存，地图已同步更新", "success");
  };

  // 恢复默认
  const handleReset = () => {
    setCenter(DEFAULT_CENTER);
    setZoom(DEFAULT_ZOOM);
    if (mapRef.current && markerRef.current) {
      mapRef.current.setZoomAndCenter(DEFAULT_ZOOM, DEFAULT_CENTER);
      markerRef.current.setPosition(DEFAULT_CENTER);
    }
    saveMapSettings({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM });
    toast("已恢复默认设置", "success");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* 地图容器 */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: 280,
          borderRadius: 12,
          overflow: "hidden",
          border: "1px solid #e4e8ef",
          background: "#f0f3f7",
        }}
      >
        <div
          ref={containerRef}
          style={{ width: "100%", height: "100%" }}
        />
        {!mapReady && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#8a95a8",
              fontSize: 13,
            }}
          >
            地图加载中...
          </div>
        )}
        {/* 提示条 */}
        {mapReady && (
          <div
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              padding: "4px 10px",
              borderRadius: 6,
              background: "rgba(255,255,255,0.92)",
              boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
              fontSize: 12,
              color: "#5a6577",
              fontWeight: 600,
              pointerEvents: "none",
            }}
          >
            点击地图选取中心点，或拖动红色标记
          </div>
        )}
      </div>

      {/* 选中地址显示 */}
      {address && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 12px",
            borderRadius: 8,
            background: "#f0f3f7",
            fontSize: 12,
            color: "#5a6577",
          }}
        >
          <MapPin size={13} color="#e74c3c" />
          {address}
        </div>
      )}

      {/* 坐标显示（只读） */}
      <div
        style={{
          display: "flex",
          gap: 12,
          fontSize: 12,
          color: "#8a95a8",
        }}
      >
        <span>
          经度：<b style={{ color: "#2b405b" }}>{center[0].toFixed(6)}</b>
        </span>
        <span>
          纬度：<b style={{ color: "#2b405b" }}>{center[1].toFixed(6)}</b>
        </span>
      </div>

      {/* 缩放级别滑块 */}
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 6,
          }}
        >
          <label
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#2b405b",
            }}
          >
            默认缩放级别
          </label>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#2f80ed",
              minWidth: 28,
              textAlign: "right",
            }}
          >
            {zoom}
          </span>
        </div>
        <input
          type="range"
          min={3}
          max={20}
          step={1}
          value={zoom}
          onChange={(e) => handleZoomChange(Number(e.target.value))}
          style={{ width: "100%", accentColor: "#2f80ed" }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 10,
            color: "#b0b8c4",
            marginTop: 2,
          }}
        >
          <span>省</span>
          <span>市</span>
          <span>区</span>
          <span>街道</span>
          <span>建筑</span>
        </div>
      </div>

      {/* 操作按钮 */}
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={handleLocate}
          disabled={locating}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "8px 16px",
            border: "1px solid #2f80ed",
            borderRadius: 8,
            background: "#fff",
            color: "#2f80ed",
            fontSize: 13,
            fontWeight: 600,
            cursor: locating ? "not-allowed" : "pointer",
            opacity: locating ? 0.6 : 1,
          }}
        >
          <LocateFixed size={14} />
          {locating ? "定位中..." : "当前位置"}
        </button>
        <button
          onClick={handleReset}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "8px 16px",
            border: "1px solid #e4e8ef",
            borderRadius: 8,
            background: "#fff",
            color: "#8a95a8",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <RotateCcw size={14} />
          默认
        </button>
        <button
          onClick={handleSave}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "8px 20px",
            border: "none",
            borderRadius: 8,
            background: "linear-gradient(135deg, #27ae60, #2f80ed)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            flex: 1,
          }}
        >
          <Save size={14} />
          保存设置
        </button>
      </div>

      <div
        style={{
          fontSize: 12,
          color: "#8a95a8",
          lineHeight: 1.6,
        }}
      >
        提示：点击地图选取默认中心点，拖动滑块调整缩放级别。保存后地图首页立即同步更新。
      </div>
    </div>
  );
}
