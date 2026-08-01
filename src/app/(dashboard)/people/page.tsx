"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, Users, Home, Trash2, Pencil } from "lucide-react";
import { TagBadge } from "@/components/ui/TagBadge";
import { allTags, getTagColor, tagIconMap } from "@/lib/tags";
import { maskPhone } from "@/lib/utils";
import { HouseholdForm } from "@/components/household/HouseholdForm";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import type { Household, Tag } from "@/types";
import { apiFetch } from "@/lib/api";

export default function PeoplePage() {
  const { toast } = useToast();
  const [households, setHouseholds] = useState<Household[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<Tag | null>(null);
  // 编辑弹窗状态
  const [editing, setEditing] = useState<Household | null>(null);
  const [editPickPosition, setEditPickPosition] = useState<{
    lng: number;
    lat: number;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/households")
      .then((data) => {
        if (cancelled) return;
        setHouseholds(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error(err);
        toast("加载数据失败", "error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const handleDeleteClick = (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteTarget(id);
  };

  const confirmDelete = async () => {
    if (deleteTarget === null) return;
    const id = deleteTarget;
    try {
      await apiFetch(`/api/households/${id}`, { method: "DELETE" });
      setHouseholds((prev) => prev.filter((h) => h.id !== id));
      toast("住户已删除", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "删除失败", "error");
    } finally {
      setDeleteTarget(null);
    }
  };

  // 打开编辑弹窗：预填位置
  const handleEditClick = (e: React.MouseEvent, h: Household) => {
    e.preventDefault();
    e.stopPropagation();
    const lng = Number(h.longitude);
    const lat = Number(h.latitude);
    setEditPickPosition(
      isNaN(lng) || isNaN(lat) ? null : { lng, lat }
    );
    setEditing(h);
  };

  // 编辑地图选点
  const handleEditMapClick = (lng: number, lat: number) => {
    setEditPickPosition({ lng, lat });
  };

  // 保存编辑
  const handleSaveEdit = async (data: Record<string, unknown>) => {
    if (!editing) return;
    try {
      const updated = await apiFetch(`/api/households/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      setHouseholds((prev) => prev.map((h) => (h.id === editing.id ? updated : h)));
      setEditing(null);
      setEditPickPosition(null);
      toast("住户信息已更新", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "保存失败", "error");
    }
  };

  const filtered = households.filter((h) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      h.householdName.toLowerCase().includes(q) ||
      h.headName.toLowerCase().includes(q) ||
      h.phone.includes(q) ||
      h.groupName.toLowerCase().includes(q);
    const matchTag = !activeTag || (Array.isArray(h.tags) ? h.tags : []).includes(activeTag);
    return matchSearch && matchTag;
  });

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#8a95a8" }}>
        加载中...
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 24px", maxWidth: 1100, margin: "0 auto" }}>
      <h1
        style={{
          fontSize: 22,
          fontWeight: 800,
          color: "#2b405b",
          margin: "0 0 20px",
        }}
      >
        人员管理
      </h1>

      {/* Search bar */}
      <div
        style={{
          position: "relative",
          marginBottom: 16,
        }}
      >
        <Search
          size={16}
          color="#8a95a8"
          style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}
        />
        <input
          type="text"
          placeholder="搜索姓名、电话、组别..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 14px 10px 40px",
            borderRadius: 10,
            border: "1px solid #e4e8ef",
            fontSize: 14,
            outline: "none",
            background: "#fff",
            color: "#2b405b",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* Tag filter buttons */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
        <button
          onClick={() => setActiveTag(null)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 12px",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            border: activeTag === null ? "2px solid #2f80ed" : "1px solid #e4e8ef",
            background: activeTag === null ? "#2f80ed15" : "#fff",
            color: activeTag === null ? "#2f80ed" : "#8a95a8",
            cursor: "pointer",
          }}
        >
          全部
          <span
            style={{
              minWidth: 18,
              height: 18,
              padding: "0 5px",
              borderRadius: 9,
              background: activeTag === null ? "#2f80ed" : "#eef1f5",
              color: activeTag === null ? "#fff" : "#8a95a8",
              fontSize: 11,
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
            }}
          >
            {households.length}
          </span>
        </button>
        {allTags.map((tag) => {
          const count = households.filter((h) =>
            (Array.isArray(h.tags) ? h.tags : []).includes(tag)
          ).length;
          const color = getTagColor(tag);
          const active = activeTag === tag;
          return (
            <button
              key={tag}
              onClick={() => setActiveTag(active ? null : tag)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "4px 12px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                border: active ? `2px solid ${color}` : "1px solid #e4e8ef",
                background: active ? `${color}15` : "#fff",
                color: active ? color : "#8a95a8",
                cursor: "pointer",
              }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="currentColor"
                style={{ flexShrink: 0 }}
              >
                <path d={tagIconMap[tag]} />
              </svg>
              {tag}
              <span
                style={{
                  minWidth: 18,
                  height: 18,
                  padding: "0 5px",
                  borderRadius: 9,
                  background: active ? color : "#eef1f5",
                  color: active ? "#fff" : "#8a95a8",
                  fontSize: 11,
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  lineHeight: 1,
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Card grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 16,
        }}
      >
        {filtered.map((h) => {
          const tags = Array.isArray(h.tags) ? h.tags : [];
          return (
            <Link
              key={h.id}
              href={`/household/${h.id}`}
              style={{ textDecoration: "none" }}
            >
              <div
                className="people-card"
                style={{
                  background: "#fff",
                  borderRadius: 14,
                  padding: "18px 20px",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                  cursor: "pointer",
                  transition: "box-shadow 0.2s",
                  border: "1px solid #f0f2f5",
                  position: "relative",
                }}
              >
                {/* Household name & head */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 8,
                      background: tags.length > 0 ? `${getTagColor(tags[0])}15` : "#f0f2f5",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: tags.length > 0 ? getTagColor(tags[0]) : "#8a95a8",
                      flexShrink: 0,
                    }}
                  >
                    <Home size={16} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: "#2b405b",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {h.householdName}
                    </div>
                    <div style={{ fontSize: 12, color: "#8a95a8" }}>
                      {h.headName} · {maskPhone(h.phone)}
                    </div>
                  </div>
                </div>

                {/* Group & member count */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 10,
                    fontSize: 12,
                    color: "#5a6577",
                  }}
                >
                  <span>{h.groupName}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <Users size={12} />
                    {h.memberCount}人
                  </span>
                </div>

                {/* Tags */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                  {tags.map((tag) => (
                    <TagBadge key={tag} tag={tag} />
                  ))}
                </div>

                {/* Last visit + 右下角操作按钮 */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "space-between",
                    marginTop: 8,
                  }}
                >
                  <div style={{ fontSize: 11, color: "#b0b8c8" }}>
                    {h.lastVisitAt
                      ? `最近走访: ${new Date(h.lastVisitAt).toLocaleDateString("zh-CN")}`
                      : "暂无走访记录"}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={(e) => handleEditClick(e, h)}
                      title="编辑"
                      className="people-btn-edit"
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        border: "none",
                        background: "rgba(47,128,237,0.08)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 0,
                        transition: "background 0.2s",
                      }}
                    >
                      <Pencil size={13} color="#2f80ed" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteClick(e, h.id)}
                      title="删除"
                      className="people-btn-delete"
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        border: "none",
                        background: "rgba(235,87,87,0.08)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 0,
                        transition: "background 0.2s",
                      }}
                    >
                      <Trash2 size={13} color="#eb5757" />
                    </button>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div
          style={{
            textAlign: "center",
            color: "#8a95a8",
            fontSize: 14,
            padding: 40,
          }}
        >
          没有找到匹配的住户
        </div>
      )}

      {/* 编辑弹窗 */}
      {editing && (
        <HouseholdForm
          pickPosition={editPickPosition}
          onMapClick={handleEditMapClick}
          onSave={handleSaveEdit}
          onClose={() => {
            setEditing(null);
            setEditPickPosition(null);
          }}
          initialData={editing}
        />
      )}

      {/* 删除确认弹窗 */}
      <Modal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="确认删除"
        subtitle="此操作不可撤销"
      >
        <div style={{ padding: "0 24px 24px" }}>
          <p style={{ fontSize: 14, color: "#5a6577", lineHeight: 1.6, marginBottom: 20 }}>
            确定要删除该住户吗？关联的走访记录和家庭成员将一并删除。
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button
              onClick={() => setDeleteTarget(null)}
              style={{
                padding: "8px 20px", borderRadius: 8, border: "1px solid #e4e8ef",
                background: "#fff", color: "#5a6577", fontSize: 14, cursor: "pointer",
              }}
            >
              取消
            </button>
            <button
              onClick={confirmDelete}
              style={{
                padding: "8px 20px", borderRadius: 8, border: "none",
                background: "#eb5757", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}
            >
              确认删除
            </button>
          </div>
        </div>
      </Modal>

      {/* Responsive overrides via media query — inline media queries are not possible, so we add a style tag */}
      <style>{`
        @media (max-width: 900px) {
          div[style*="grid-template-columns: repeat(3"] {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 600px) {
          div[style*="grid-template-columns: repeat(3"] {
            grid-template-columns: 1fr !important;
          }
        }
        .people-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.1) !important; }
        .people-btn-edit:hover { background: rgba(47,128,237,0.18) !important; }
        .people-btn-delete:hover { background: rgba(235,87,87,0.18) !important; }
      `}</style>
    </div>
  );
}
