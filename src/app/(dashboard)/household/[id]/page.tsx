"use client";

import { use, useEffect, useState } from "react";
import type { Household, Member, Visit } from "@/types";
import { TagBadge } from "@/components/ui/TagBadge";
import { maskPhone } from "@/lib/utils";
import { allTags, getTagColor } from "@/lib/tags";
import { apiUrl } from "@/lib/api";
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

  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("基本信息");
  const [loading, setLoading] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [hRes, mRes, vRes] = await Promise.all([
          fetch(apiUrl(`/api/households/${id}`)),
          fetch(apiUrl(`/api/members?householdId=${id}`)),
          fetch(apiUrl(`/api/visits?householdId=${id}`)),
        ]);

        if (!hRes.ok) throw new Error("住户不存在");

        const hData = await hRes.json();
        const mData = await mRes.json();
        const vData = await vRes.json();

        setHousehold(hData);
        setMembers(Array.isArray(mData) ? mData : []);
        setVisits(Array.isArray(vData) ? vData : []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

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
    <div className="household-detail-page">
      {/* Back button */}
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
          marginBottom: 16,
        }}
      >
        <ArrowLeft size={15} />
        返回地图
      </Link>

      {/* Hero section */}
      <div className="detail-hero-card">
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
          {household.tags.map((tag) => (
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
          <div className="detail-info-grid">
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
                  <div className="member-tags">
                    {m.tags.map((tag) => (
                      <TagBadge key={tag} tag={tag} />
                    ))}
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
                      {v.concerns.length > 0 && (
                        <div
                          style={{
                            display: "flex",
                            gap: 4,
                            marginTop: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          {v.concerns.map((c) => (
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
        <div className="detail-photo-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              style={{
                aspectRatio: "1",
                borderRadius: 10,
                background: "#f0f3f7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#8a95a8",
                fontSize: 12,
              }}
            >
              暂无图片
            </div>
          ))}
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMember && (
        <AddMemberModal
          householdId={Number(id)}
          onClose={() => setShowAddMember(false)}
          onSuccess={() => {
            setShowAddMember(false);
            // Refresh members list
            fetch(apiUrl(`/api/members?householdId=${id}`))
              .then((res) => res.json())
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
}: {
  householdId: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("其他");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("男");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert("请输入姓名");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(apiUrl("/api/members"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          householdId,
          name: name.trim(),
          relation,
          age: age ? Number(age) : null,
          gender,
          tags: selectedTags,
        }),
      });
      if (!res.ok) {
        throw new Error("添加失败");
      }
      onSuccess();
    } catch {
      alert("添加成员失败，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div className="member-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <h2
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: "#2b405b",
              margin: 0,
            }}
          >
            添加成员
          </h2>
          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "#8a95a8",
              padding: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* 姓名 */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 600,
                color: "#2b405b",
                marginBottom: 6,
              }}
            >
              姓名 <span style={{ color: "#EB5757" }}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="请输入姓名"
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #e0e4ea",
                borderRadius: 8,
                fontSize: 13,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* 与户主关系 */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 600,
                color: "#2b405b",
                marginBottom: 6,
              }}
            >
              与户主关系
            </label>
            <select
              value={relation}
              onChange={(e) => setRelation(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #e0e4ea",
                borderRadius: 8,
                fontSize: 13,
                outline: "none",
                background: "#fff",
                boxSizing: "border-box",
              }}
            >
              {relationOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* 年龄 */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 600,
                color: "#2b405b",
                marginBottom: 6,
              }}
            >
              年龄
            </label>
            <input
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="请输入年龄"
              min={0}
              max={150}
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #e0e4ea",
                borderRadius: 8,
                fontSize: 13,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* 性别 */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 600,
                color: "#2b405b",
                marginBottom: 6,
              }}
            >
              性别
            </label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #e0e4ea",
                borderRadius: 8,
                fontSize: 13,
                outline: "none",
                background: "#fff",
                boxSizing: "border-box",
              }}
            >
              <option value="男">男</option>
              <option value="女">女</option>
            </select>
          </div>

          {/* 标签 */}
          <div style={{ marginBottom: 24 }}>
            <label
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 600,
                color: "#2b405b",
                marginBottom: 6,
              }}
            >
              标签
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {allTags.map((tag) => (
                <label
                  key={tag}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    cursor: "pointer",
                    fontSize: 12,
                    padding: "4px 10px",
                    borderRadius: 6,
                    border: `1px solid ${
                      selectedTags.includes(tag) ? getTagColor(tag) : "#e0e4ea"
                    }`,
                    background: selectedTags.includes(tag)
                      ? `${getTagColor(tag)}15`
                      : "transparent",
                    color: selectedTags.includes(tag)
                      ? getTagColor(tag)
                      : "#5a6577",
                    fontWeight: selectedTags.includes(tag) ? 600 : 400,
                    transition: "all 0.15s",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedTags.includes(tag)}
                    onChange={() => toggleTag(tag)}
                    style={{ display: "none" }}
                  />
                  {tag}
                </label>
              ))}
            </div>
          </div>

          {/* Buttons */}
          <div
            style={{
              display: "flex",
              gap: 10,
              justifyContent: "flex-end",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 20px",
                border: "1px solid #e0e4ea",
                borderRadius: 8,
                background: "#fff",
                color: "#5a6577",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: "8px 20px",
                border: "none",
                borderRadius: 8,
                background: "linear-gradient(135deg, #27ae60, #2f80ed)",
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                cursor: submitting ? "not-allowed" : "pointer",
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? "提交中..." : "确认添加"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
