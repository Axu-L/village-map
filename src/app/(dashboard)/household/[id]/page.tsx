"use client";

import { use, useEffect, useState } from "react";
import type { Household, Member, Tag, Visit } from "@/types";
import { TagBadge } from "@/components/ui/TagBadge";
import { maskPhone } from "@/lib/utils";
import { allTags, getTagColor } from "@/lib/tags";
import { assetUrl, apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { HouseholdForm } from "@/components/household/HouseholdForm";
import {
  ArrowLeft,
  Navigation,
  PlusCircle,
  User,
  Phone,
  MapPin,
  Home,
  Calendar,
  X,
  Pencil,
  Trash2,
} from "lucide-react";
import Link from "next/link";

type TabKey = "基本信息" | "家庭成员" | "走访记录" | "图片";

const tabs: TabKey[] = ["基本信息", "家庭成员", "走访记录", "图片"];

export default function HouseholdDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { toast } = useToast();

  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("基本信息");
  const [loading, setLoading] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [showEditHousehold, setShowEditHousehold] = useState(false);
  const [editPickPosition, setEditPickPosition] = useState<{
    lng: number;
    lat: number;
  } | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // 读取 ?edit=1 参数，进入编辑模式
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("edit") === "1" && household) {
      const lng = Number(household.longitude);
      const lat = Number(household.latitude);
      setEditPickPosition(
        isNaN(lng) || isNaN(lat) ? null : { lng, lat }
      );
      setShowEditHousehold(true);
    }
  }, [household]);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const [hData, mData, vData] = await Promise.all([
          apiFetch(`/api/households/${id}`),
          apiFetch(`/api/members?householdId=${id}`),
          apiFetch(`/api/visits?householdId=${id}`),
        ]);

        if (cancelled) return;
        setHousehold(hData);
        setMembers(Array.isArray(mData) ? mData : []);
        setVisits(Array.isArray(vData) ? vData : []);
      } catch (err) {
        console.error(err);
        if (!cancelled) toast("加载数据失败", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // 保存编辑住户
  const handleSaveEditHousehold = async (data: Record<string, unknown>) => {
    try {
      const updated = await apiFetch(`/api/households/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      setHousehold(updated);
      setShowEditHousehold(false);
      setEditPickPosition(null);
      // 清除 URL 中的 edit 参数，防止 household 变化后重新触发编辑模式
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("edit");
        window.history.replaceState({}, "", url.pathname + url.search);
      }
      toast("住户信息已更新", "success");
    } catch (err) {
      console.error(err);
      toast(err instanceof Error ? err.message : "保存失败", "error");
    }
  };

  // 删除成员
  const handleDeleteMember = async (memberId: number) => {
    if (!confirm("确定要删除该成员吗？")) return;
    try {
      await apiFetch(`/api/members/${memberId}`, {
        method: "DELETE",
      });
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      toast("成员已删除", "success");
    } catch (err) {
      console.error(err);
      toast(err instanceof Error ? err.message : "删除失败", "error");
    }
  };

  // 聚合所有走访图片
  const allVisitImages: { url: string; visitDate: string }[] = [];
  for (const v of visits) {
    const imgs = Array.isArray(v.images) ? v.images : [];
    for (const img of imgs) {
      allVisitImages.push({ url: assetUrl(img), visitDate: v.visitDate });
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#8a95a8" }}>
        加载中...
      </div>
    );
  }

  if (!household) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#8a95a8" }}>
        住户不存在
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 24px", maxWidth: 720, margin: "0 auto" }}>
      {/* Back button + actions */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <Link
          href="/map"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "#2f80ed",
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          <ArrowLeft size={15} />
          返回地图
        </Link>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => {
              const lng = Number(household.longitude);
              const lat = Number(household.latitude);
              if (isNaN(lng) || isNaN(lat) || (lng === 0 && lat === 0)) {
                toast("该住户未设置位置信息", "error");
                return;
              }
              const name = encodeURIComponent(household.householdName);
              window.open(
                `https://uri.amap.com/navigation?to=${lng},${lat},${name}`,
                "_blank"
              );
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "6px 14px",
              border: "1px solid #e4e8ef",
              borderRadius: 8,
              background: "#fff",
              color: "#2f80ed",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Navigation size={13} />
            导航
          </button>
          <button
            onClick={() => {
              const lng = Number(household.longitude);
              const lat = Number(household.latitude);
              setEditPickPosition(
                isNaN(lng) || isNaN(lat) ? null : { lng, lat }
              );
              setShowEditHousehold(true);
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "6px 14px",
              border: "none",
              borderRadius: 8,
              background: "linear-gradient(135deg, #27ae60, #2f80ed)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <Pencil size={13} />
            编辑
          </button>
        </div>
      </div>

      {/* Hero section */}
      <div
        style={{
          background: "#fff",
          borderRadius: 14,
          padding: "20px 24px",
          marginBottom: 20,
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        }}
      >
        <h1
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: "#2b405b",
            margin: "0 0 6px",
          }}
        >
          {household.householdName}
        </h1>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 12,
            fontSize: 13,
            color: "#8a95a8",
          }}
        >
          <Home size={13} />
          <span>{household.groupName}</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {(Array.isArray(household.tags) ? household.tags : []).map((tag) => (
            <TagBadge key={tag} tag={tag} />
          ))}
        </div>
      </div>

      {/* Tab switching */}
      <div
        style={{
          display: "flex",
          gap: 0,
          background: "#f0f3f7",
          borderRadius: 10,
          padding: 3,
          marginBottom: 20,
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: "8px 0",
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: activeTab === tab ? 700 : 500,
              color: activeTab === tab ? "#2f80ed" : "#8a95a8",
              background: activeTab === tab ? "#fff" : "transparent",
              cursor: "pointer",
              boxShadow: activeTab === tab ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              transition: "all 0.15s",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "基本信息" && (
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
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "16px 24px",
            }}
          >
            <InfoItem icon={<User size={15} />} label="户主" value={household.headName} />
            <InfoItem icon={<Phone size={15} />} label="电话" value={maskPhone(household.phone)} />
            <InfoItem icon={<MapPin size={15} />} label="地址" value={household.address} />
            <InfoItem icon={<Home size={15} />} label="组别" value={household.groupName} />
            <InfoItem
              icon={<Navigation size={15} />}
              label="纬度"
              value={household.latitude}
            />
            <InfoItem
              icon={<Navigation size={15} />}
              label="经度"
              value={household.longitude}
            />
          </div>
        </div>
      )}

      {activeTab === "家庭成员" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <button
              onClick={() => setShowAddMember(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "7px 14px",
                border: "none",
                borderRadius: 8,
                background: "linear-gradient(135deg, #27ae60, #2f80ed)",
                color: "#fff",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <PlusCircle size={14} />
              添加成员
            </button>
          </div>

          {members.length === 0 ? (
            <div
              style={{
                background: "#fff",
                borderRadius: 14,
                padding: "40px 24px",
                textAlign: "center",
                color: "#8a95a8",
                fontSize: 13,
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }}
            >
              暂无成员信息
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {members.map((m) => (
                <div
                  key={m.id}
                  style={{
                    background: "#fff",
                    borderRadius: 12,
                    padding: "14px 18px",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                  }}
                >
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: "50%",
                      background: "#f0f3f7",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#8a95a8",
                      flexShrink: 0,
                    }}
                  >
                    <User size={16} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 14,
                        color: "#2b405b",
                        marginBottom: 2,
                      }}
                    >
                      {m.name}
                      {m.relation && (
                        <span
                          style={{
                            fontWeight: 500,
                            fontSize: 12,
                            color: "#8a95a8",
                            marginLeft: 8,
                          }}
                        >
                          {m.relation}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "#8a95a8" }}>
                      {m.gender ?? "未知"}
                      {m.age != null ? ` · ${m.age}岁` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {m.tags.map((tag) => (
                        <TagBadge key={tag} tag={tag} />
                      ))}
                    </div>
                    <button
                      onClick={() => setEditingMember(m)}
                      title="编辑"
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: "50%",
                        border: "none",
                        background: "rgba(47,128,237,0.08)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 0,
                        flexShrink: 0,
                      }}
                    >
                      <Pencil size={12} color="#2f80ed" />
                    </button>
                    <button
                      onClick={() => handleDeleteMember(m.id)}
                      title="删除"
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: "50%",
                        border: "none",
                        background: "rgba(235,87,87,0.08)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 0,
                        flexShrink: 0,
                      }}
                    >
                      <Trash2 size={12} color="#eb5757" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "走访记录" && (
        <div>
          {visits.length === 0 ? (
            <div
              style={{
                background: "#fff",
                borderRadius: 14,
                padding: "40px 24px",
                textAlign: "center",
                color: "#8a95a8",
                fontSize: 13,
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }}
            >
              暂无走访记录
            </div>
          ) : (
            <div style={{ position: "relative", paddingLeft: 20 }}>
              {/* Timeline line */}
              <div
                style={{
                  position: "absolute",
                  left: 6,
                  top: 8,
                  bottom: 8,
                  width: 2,
                  background: "#e0e4ea",
                  borderRadius: 1,
                }}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {visits.map((v) => (
                  <div key={v.id} style={{ position: "relative", paddingLeft: 20 }}>
                    {/* Timeline dot */}
                    <div
                      style={{
                        position: "absolute",
                        left: -17,
                        top: 6,
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: "#2f80ed",
                        border: "2px solid #fff",
                        boxShadow: "0 0 0 2px #2f80ed30",
                      }}
                    />
                    <div
                      style={{
                        background: "#fff",
                        borderRadius: 12,
                        padding: "14px 18px",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 6,
                        }}
                      >
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            fontSize: 13,
                            fontWeight: 700,
                            color: "#2b405b",
                          }}
                        >
                          <Calendar size={13} />
                          {v.visitor}
                        </span>
                        <span style={{ fontSize: 12, color: "#8a95a8" }}>
                          {new Date(v.visitDate).toLocaleDateString("zh-CN")}
                        </span>
                      </div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 13,
                          color: "#5a6577",
                          lineHeight: 1.6,
                        }}
                      >
                        {v.content}
                      </p>
                      {(Array.isArray(v.concerns) ? v.concerns : []).length > 0 && (
                        <div
                          style={{
                            display: "flex",
                            gap: 4,
                            marginTop: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          {(Array.isArray(v.concerns) ? v.concerns : []).map((c) => (
                            <span
                              key={c}
                              style={{
                                padding: "2px 8px",
                                borderRadius: 4,
                                fontSize: 11,
                                background: "#f0f3f7",
                                color: "#5a6577",
                              }}
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "图片" && (
        <div>
          {allVisitImages.length === 0 ? (
            <div
              style={{
                background: "#fff",
                borderRadius: 14,
                padding: "40px 24px",
                textAlign: "center",
                color: "#8a95a8",
                fontSize: 13,
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }}
            >
              暂无图片
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 10,
              }}
            >
              {allVisitImages.map((img, idx) => (
                <div
                  key={idx}
                  style={{
                    aspectRatio: "1",
                    borderRadius: 10,
                    overflow: "hidden",
                    cursor: "pointer",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                    position: "relative",
                  }}
                  onClick={() => setPreviewImage(img.url)}
                >
                  <img
                    src={img.url}
                    alt={`走访图片 ${idx + 1}`}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      bottom: 4,
                      left: 4,
                      padding: "2px 6px",
                      borderRadius: 4,
                      background: "rgba(0,0,0,0.5)",
                      color: "#fff",
                      fontSize: 10,
                    }}
                  >
                    {img.visitDate}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 图片预览 Lightbox */}
      {previewImage && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
            cursor: "zoom-out",
          }}
          onClick={() => setPreviewImage(null)}
        >
          <img
            src={previewImage}
            alt="预览"
            style={{
              maxWidth: "90vw",
              maxHeight: "90vh",
              borderRadius: 8,
              objectFit: "contain",
            }}
          />
          <button
            style={{
              position: "absolute",
              top: 20,
              right: 20,
              width: 40,
              height: 40,
              borderRadius: "50%",
              border: "none",
              background: "rgba(255,255,255,0.2)",
              color: "#fff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={20} />
          </button>
        </div>
      )}

      {/* 编辑住户表单 */}
      {showEditHousehold && household && (
        <HouseholdForm
          pickPosition={editPickPosition}
          onMapClick={(lng, lat) => setEditPickPosition({ lng, lat })}
          onSave={handleSaveEditHousehold}
          onClose={() => {
            setShowEditHousehold(false);
            setEditPickPosition(null);
            // 清除 URL 中的 edit 参数
            if (typeof window !== "undefined") {
              const url = new URL(window.location.href);
              url.searchParams.delete("edit");
              window.history.replaceState({}, "", url.toString());
            }
          }}
          initialData={household}
        />
      )}

      {/* Add Member Modal */}
      {showAddMember && (
        <AddMemberModal
          householdId={Number(id)}
          onClose={() => setShowAddMember(false)}
          onSuccess={() => {
            setShowAddMember(false);
            // Refresh members list
            apiFetch(`/api/members?householdId=${id}`)
              .then((data) => setMembers(Array.isArray(data) ? data : []))
              .catch(() => {});
          }}
        />
      )}

      {/* Edit Member Modal */}
      {editingMember && (
        <AddMemberModal
          householdId={Number(id)}
          initialData={editingMember}
          onClose={() => setEditingMember(null)}
          onSuccess={() => {
            setEditingMember(null);
            apiFetch(`/api/members?householdId=${id}`)
              .then((data) => setMembers(Array.isArray(data) ? data : []))
              .catch(() => {});
          }}
        />
      )}
    </div>
  );
}

function InfoItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          fontSize: 12,
          color: "#8a95a8",
          marginBottom: 4,
        }}
      >
        {icon}
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "#2b405b" }}>
        {value || "-"}
      </div>
    </div>
  );
}

const relationOptions = ["户主", "配偶", "子女", "孙辈", "父母", "其他"];

function AddMemberModal({
  householdId,
  onClose,
  onSuccess,
  initialData,
}: {
  householdId: number;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: Member;
}) {
  const { toast } = useToast();
  const isEdit = !!initialData;
  const [name, setName] = useState(initialData?.name || "");
  const [relation, setRelation] = useState(initialData?.relation || "其他");
  const [age, setAge] = useState(
    initialData?.age != null ? String(initialData.age) : ""
  );
  const [gender, setGender] = useState(initialData?.gender || "男");
  const [selectedTags, setSelectedTags] = useState<Tag[]>(
    initialData?.tags || []
  );
  const [submitting, setSubmitting] = useState(false);

  const toggleTag = (tag: Tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast("请输入姓名", "error");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        householdId,
        name: name.trim(),
        relation,
        age: age ? Number(age) : null,
        gender,
        tags: selectedTags,
      };
      const path = isEdit
        ? `/api/members/${initialData!.id}`
        : "/api/members";
      const method = isEdit ? "PUT" : "POST";
      await apiFetch(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      toast(isEdit ? "成员已更新" : "成员已添加", "success");
      onSuccess();
    } catch (err) {
      toast(err instanceof Error ? err.message : isEdit ? "更新成员失败，请重试" : "添加成员失败，请重试", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-layer" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 460 }}
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <h2>{isEdit ? "编辑成员" : "添加成员"}</h2>
          <button className="close-button" aria-label="关闭" onClick={onClose}>
            <X size={20} />
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label>
              姓名 <span style={{ color: "#EB5757" }}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="请输入姓名"
            />
          </div>

          <div className="form-field">
            <label>与户主关系</label>
            <select
              value={relation}
              onChange={(e) => setRelation(e.target.value)}
            >
              {relationOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>年龄</label>
            <input
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="请输入年龄"
              min={0}
              max={150}
            />
          </div>

          <div className="form-field">
            <label>性别</label>
            <select value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="男">男</option>
              <option value="女">女</option>
            </select>
          </div>

          <div className="form-field">
            <label>标签</label>
            <div className="tag-select-group">
              {allTags.map((tag) => {
                const active = selectedTags.includes(tag);
                const color = getTagColor(tag);
                return (
                  <label
                    key={tag}
                    className={`tag-select-btn ${active ? "active" : ""}`}
                    style={
                      active
                        ? {
                            color,
                            background: `${color}15`,
                            borderColor: color,
                          }
                        : undefined
                    }
                  >
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => toggleTag(tag)}
                      style={{ display: "none" }}
                    />
                    {tag}
                  </label>
                );
              })}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
            <button type="button" className="soft-button" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="primary-button" disabled={submitting}>
              {submitting ? "提交中..." : isEdit ? "确认修改" : "确认添加"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
