"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Calendar, Clock, ChevronDown, MapPin, User, Image as ImageIcon } from "lucide-react";
import type { Household, Visit } from "@/types";
import { apiUrl } from "@/lib/api";

export default function VisitsPage() {
  const [households, setHouseholds] = useState<Household[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function fetchData() {
      try {
        const [hRes, vRes] = await Promise.all([
          fetch(apiUrl("/api/households")),
          fetch(apiUrl("/api/visits")),
        ]);
        const hData = await hRes.json();
        const vData = await vRes.json();
        setHouseholds(Array.isArray(hData) ? hData : []);
        setVisits(Array.isArray(vData) ? vData : []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // householdId → household 映射
  const householdMap = useMemo(() => {
    const m = new Map<number, Household>();
    households.forEach((h) => m.set(h.id, h));
    return m;
  }, [households]);

  // 按 visitDate 分组（YYYY-MM-DD），倒序
  const grouped = useMemo(() => {
    const groups: Record<string, Visit[]> = {};
    visits.forEach((v) => {
      const key = (v.visitDate || "").slice(0, 10);
      if (!groups[key]) groups[key] = [];
      groups[key].push(v);
    });
    // 组内按 createdAt/visitDate 倒序（同一天晚的在前）
    Object.values(groups).forEach((arr) =>
      arr.sort((a, b) => {
        const ta = new Date(a.createdAt || a.visitDate).getTime();
        const tb = new Date(b.createdAt || b.visitDate).getTime();
        return tb - ta;
      })
    );
    // 日期倒序
    return Object.entries(groups).sort(
      ([a], [b]) => new Date(b).getTime() - new Date(a).getTime()
    );
  }, [visits]);

  const toggle = (key: string) =>
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

  // 统计
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const thisMonthVisitCount = visits.filter((v) =>
    (v.visitDate || "").startsWith(currentMonth)
  ).length;

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#8a95a8" }}>
        加载中...
      </div>
    );
  }

  // 格式化日期标题：2026-07-13 → 7月13日 周六
  const formatDateTitle = (key: string) => {
    if (!key) return "未知日期";
    const d = new Date(key + "T00:00:00");
    if (isNaN(d.getTime())) return key;
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(d);
    target.setHours(0, 0, 0, 0);
    const diff = Math.round((today.getTime() - target.getTime()) / 86400000);
    let prefix = "";
    if (diff === 0) prefix = "今天 · ";
    else if (diff === 1) prefix = "昨天 · ";
    return `${prefix}${month}月${day}日 ${weekdays[d.getDay()]}`;
  };

  return (
    <div style={{ padding: "20px 24px", maxWidth: 900, margin: "0 auto" }}>
      <h1
        style={{
          fontSize: 22,
          fontWeight: 800,
          color: "#2b405b",
          margin: "0 0 20px",
        }}
      >
        入户记录
      </h1>

      {/* Summary cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            padding: "18px 20px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: "#2f80ed15",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#2f80ed",
              marginBottom: 12,
            }}
          >
            <Calendar size={20} />
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#2b405b", lineHeight: 1 }}>
            {thisMonthVisitCount}
          </div>
          <div style={{ fontSize: 12, color: "#8a95a8", marginTop: 4 }}>本月走访次数</div>
        </div>

        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            padding: "18px 20px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: "#27ae6015",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#27ae60",
              marginBottom: 12,
            }}
          >
            <Clock size={20} />
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#2b405b", lineHeight: 1 }}>
            {visits.length}
          </div>
          <div style={{ fontSize: 12, color: "#8a95a8", marginTop: 4 }}>累计走访次数</div>
        </div>
      </div>

      {/* Visit list 按日期分组下拉 */}
      <div
        style={{
          background: "#fff",
          borderRadius: 14,
          padding: "20px 24px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700, color: "#2b405b", marginBottom: 16 }}>
          走访记录
        </div>

        {grouped.length === 0 ? (
          <div style={{ textAlign: "center", color: "#8a95a8", fontSize: 13, padding: 30 }}>
            暂无走访记录
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {grouped.map(([dateKey, dayVisits]) => {
              const isCollapsed = collapsed[dateKey];
              return (
                <div
                  key={dateKey}
                  style={{
                    border: "1px solid #f0f2f5",
                    borderRadius: 10,
                    overflow: "hidden",
                  }}
                >
                  {/* 日期标题（可点击折叠） */}
                  <button
                    onClick={() => toggle(dateKey)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 16px",
                      background: "#fafbfc",
                      border: "none",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "background 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = "#f4f6f9";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = "#fafbfc";
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Calendar size={15} color="#2f80ed" />
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#2b405b" }}>
                        {formatDateTitle(dateKey)}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          color: "#fff",
                          background: "#2f80ed",
                          padding: "2px 8px",
                          borderRadius: 10,
                          fontWeight: 600,
                        }}
                      >
                        {dayVisits.length} 条
                      </span>
                    </div>
                    <ChevronDown
                      size={18}
                      color="#8a95a8"
                      style={{
                        transition: "transform 0.2s",
                        transform: isCollapsed ? "rotate(-90deg)" : "rotate(0)",
                      }}
                    />
                  </button>

                  {/* 当日走访列表 */}
                  {!isCollapsed && (
                    <div style={{ borderTop: "1px solid #f0f2f5" }}>
                      {dayVisits.map((v, idx) => {
                        const h = householdMap.get(v.householdId);
                        const concerns = Array.isArray(v.concerns) ? v.concerns : [];
                        const images = Array.isArray(v.images) ? v.images : [];
                        return (
                          <Link
                            key={v.id}
                            href={h ? `/household/${h.id}` : "#"}
                            style={{ textDecoration: "none" }}
                          >
                            <div
                              style={{
                                padding: "12px 16px",
                                borderBottom:
                                  idx < dayVisits.length - 1 ? "1px solid #f5f7fa" : "none",
                                cursor: "pointer",
                                transition: "background 0.2s",
                              }}
                              onMouseEnter={(e) => {
                                (e.currentTarget as HTMLDivElement).style.background = "#fafbfc";
                              }}
                              onMouseLeave={(e) => {
                                (e.currentTarget as HTMLDivElement).style.background = "transparent";
                              }}
                            >
                              {/* 住户名 + 走访人 */}
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  gap: 12,
                                  marginBottom: 6,
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: 14,
                                    fontWeight: 600,
                                    color: "#2b405b",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                  }}
                                >
                                  <MapPin size={13} color="#2f80ed" />
                                  {h?.householdName || "未知住户"}
                                  {h && (
                                    <span style={{ fontSize: 11, color: "#8a95a8", fontWeight: 400 }}>
                                      · {h.groupName}
                                    </span>
                                  )}
                                </div>
                                <div
                                  style={{
                                    fontSize: 11,
                                    color: "#8a95a8",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 4,
                                  }}
                                >
                                  <User size={11} />
                                  {v.visitor}
                                </div>
                              </div>

                              {/* 走访内容 */}
                              <div
                                style={{
                                  fontSize: 13,
                                  color: "#5a6577",
                                  lineHeight: 1.5,
                                  marginBottom: concerns.length > 0 || images.length > 0 ? 8 : 0,
                                  display: "-webkit-box",
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: "vertical",
                                  overflow: "hidden",
                                }}
                              >
                                {v.content}
                              </div>

                              {/* 关注点 + 图片数 */}
                              {(concerns.length > 0 || images.length > 0) && (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                                  {concerns.map((c) => (
                                    <span
                                      key={c}
                                      style={{
                                        fontSize: 11,
                                        padding: "2px 8px",
                                        background: "#f2994a15",
                                        color: "#b35c00",
                                        borderRadius: 6,
                                        fontWeight: 500,
                                      }}
                                    >
                                      {c}
                                    </span>
                                  ))}
                                  {images.length > 0 && (
                                    <span
                                      style={{
                                        fontSize: 11,
                                        padding: "2px 8px",
                                        background: "#2f80ed15",
                                        color: "#2f80ed",
                                        borderRadius: 6,
                                        fontWeight: 500,
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 3,
                                      }}
                                    >
                                      <ImageIcon size={10} />
                                      {images.length}张图
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
