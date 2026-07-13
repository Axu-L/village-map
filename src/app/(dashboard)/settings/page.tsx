"use client";

import { useState, useEffect } from "react";
import { Settings, User, MapPin, Info } from "lucide-react";

export default function SettingsPage() {
  const [userInfo, setUserInfo] = useState<{ username: string; role: string }>({
    username: "",
    role: "",
  });

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
  }, []);

  const roleName: Record<string, string> = {
    admin: "管理员",
    user: "普通用户",
    visitor: "访客",
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

      {/* Section 2: 地图设置 */}
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
          <MapPin size={18} color="#e74c3c" />
          <span style={{ fontSize: 15, fontWeight: 700, color: "#2b405b" }}>
            地图设置
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 13, color: "#8a95a8", minWidth: 70 }}>默认中心</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#2b405b" }}>
              114.34, 30.52
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 13, color: "#8a95a8", minWidth: 70 }}>说明</span>
            <span style={{ fontSize: 13, color: "#5a6577" }}>
              地图默认中心点坐标（经度, 纬度）
            </span>
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
