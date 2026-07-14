"use client";

import { useState, useEffect } from "react";
import { Settings, User, MapPin, Info, Save, LocateFixed, RotateCcw } from "lucide-react";
import { getMapSettings, saveMapSettings, DEFAULT_CENTER, DEFAULT_ZOOM } from "@/lib/amap";
import { useToast } from "@/components/ui/Toast";

export default function SettingsPage() {
  const { toast } = useToast();
  const [userInfo, setUserInfo] = useState<{ username: string; role: string }>({
    username: "",
    role: "",
  });

  // 地图设置表单
  const [lng, setLng] = useState(String(DEFAULT_CENTER[0]));
  const [lat, setLat] = useState(String(DEFAULT_CENTER[1]));
  const [zoom, setZoom] = useState(String(DEFAULT_ZOOM));
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("user");
      if (stored) {
        const parsed = JSON.parse(stored);
        setUserInfo({
          username: parsed.username || parsed.displayName || "",
          role: parsed.role || "",
        });
      }
    } catch {
      // ignore
    }

    // 加载已保存的地图设置
    const { center, zoom: z } = getMapSettings();
    setLng(String(center[0]));
    setLat(String(center[1]));
    setZoom(String(z));
  }, []);

  const roleName: Record<string, string> = {
    admin: "管理员",
    user: "普通用户",
    visitor: "访客",
  };

  // 保存地图设置
  const handleSaveMapSettings = () => {
    const lngNum = Number(lng);
    const latNum = Number(lat);
    const zoomNum = Number(zoom);
    if (isNaN(lngNum) || isNaN(latNum)) {
      toast("经纬度格式不正确", "error");
      return;
    }
    if (lngNum < -180 || lngNum > 180 || latNum < -90 || latNum > 90) {
      toast("经纬度超出有效范围", "error");
      return;
    }
    if (isNaN(zoomNum) || zoomNum < 3 || zoomNum > 20) {
      toast("缩放级别应在 3-20 之间", "error");
      return;
    }
    saveMapSettings({ center: [lngNum, latNum], zoom: zoomNum });
    toast("地图设置已保存", "success");
  };

  // 从浏览器定位获取当前坐标
  const handleLocate = () => {
    if (!navigator.geolocation) {
      toast("浏览器不支持定位功能", "error");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLng(pos.coords.longitude.toFixed(6));
        setLat(pos.coords.latitude.toFixed(6));
        setLocating(false);
        toast("已获取当前位置", "success");
      },
      (err) => {
        setLocating(false);
        toast(`定位失败：${err.message}`, "error");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // 恢复默认设置
  const handleReset = () => {
    setLng(String(DEFAULT_CENTER[0]));
    setLat(String(DEFAULT_CENTER[1]));
    setZoom(String(DEFAULT_ZOOM));
    saveMapSettings({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM });
    toast("已恢复默认设置", "success");
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    border: "1px solid #e0e4ea",
    borderRadius: 8,
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
  };

  return (
    <div style={{ padding: "20px 24px", maxWidth: 700, margin: "0 auto" }}>
      <h1
        style={{
          fontSize: 22,
          fontWeight: 800,
          color: "#2b405b",
          margin: "0 0 20px",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Settings size={22} color="#2b405b" />
        系统设置
      </h1>

      {/* Section 1: 账户信息 */}
      <div
        style={{
          background: "#fff",
          borderRadius: 14,
          padding: "20px 24px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 16,
          }}
        >
          <User size={18} color="#2f80ed" />
          <span style={{ fontSize: 15, fontWeight: 700, color: "#2b405b" }}>
            账户信息
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 13, color: "#8a95a8", minWidth: 70 }}>用户名</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#2b405b" }}>
              {userInfo.username || "未登录"}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 13, color: "#8a95a8", minWidth: 70 }}>角色</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#2b405b" }}>
              {roleName[userInfo.role] || userInfo.role || "未知"}
            </span>
          </div>
        </div>
      </div>

      {/* Section 2: 地图设置（可编辑） */}
      <div
        style={{
          background: "#fff",
          borderRadius: 14,
          padding: "20px 24px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <MapPin size={18} color="#e74c3c" />
            <span style={{ fontSize: 15, fontWeight: 700, color: "#2b405b" }}>
              地图设置
            </span>
          </div>
          <button
            onClick={handleReset}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "5px 12px",
              border: "1px solid #e4e8ef",
              borderRadius: 8,
              background: "#fff",
              color: "#8a95a8",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <RotateCcw size={12} />
            恢复默认
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* 经度 */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 600,
                color: "#2b405b",
                marginBottom: 6,
              }}
            >
              经度（lng）
            </label>
            <input
              type="number"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              step="0.000001"
              min={-180}
              max={180}
              style={inputStyle}
            />
          </div>

          {/* 纬度 */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 600,
                color: "#2b405b",
                marginBottom: 6,
              }}
            >
              纬度（lat）
            </label>
            <input
              type="number"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              step="0.000001"
              min={-90}
              max={90}
              style={inputStyle}
            />
          </div>

          {/* 缩放级别 */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 600,
                color: "#2b405b",
                marginBottom: 6,
              }}
            >
              默认缩放级别（3-20）
            </label>
            <input
              type="number"
              value={zoom}
              onChange={(e) => setZoom(e.target.value)}
              min={3}
              max={20}
              style={inputStyle}
            />
          </div>

          {/* 操作按钮 */}
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
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
              {locating ? "定位中..." : "获取当前位置"}
            </button>
            <button
              onClick={handleSaveMapSettings}
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
              marginTop: 4,
            }}
          >
            提示：设置地图打开时的默认中心点和缩放级别。可手动输入坐标，或点击"获取当前位置"自动填充。保存后立即生效。
          </div>
        </div>
      </div>

      {/* Section 3: 关于系统 */}
      <div
        style={{
          background: "#fff",
          borderRadius: 14,
          padding: "20px 24px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 16,
          }}
        >
          <Info size={18} color="#27ae60" />
          <span style={{ fontSize: 15, fontWeight: 700, color: "#2b405b" }}>
            关于系统
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 13, color: "#8a95a8", minWidth: 70 }}>应用名称</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#2b405b" }}>
              村智图 VillageMap
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 13, color: "#8a95a8", minWidth: 70 }}>版本号</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#2b405b" }}>
              1.0.0
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
