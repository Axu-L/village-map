"use client";

import { useState, FormEvent, useEffect } from "react";
import { allTags, getTagColor } from "@/lib/tags";
import { X, MapPin, Check, Loader2 } from "lucide-react";
import { MapContainer } from "@/components/map/MapContainer";
import { GROUP_NAMES } from "@/lib/constants";
import type { Household, Tag } from "@/types";

interface HouseholdFormProps {
  pickPosition: { lng: number; lat: number } | null;
  onMapClick: (lng: number, lat: number) => void;
  onSave: (data: Record<string, unknown>) => void;
  onClose: () => void;
  initialData?: Household;
}

export function HouseholdForm({
  pickPosition,
  onMapClick,
  onSave,
  onClose,
  initialData,
}: HouseholdFormProps) {
  const [headName, setHeadName] = useState(initialData?.headName || "");
  const [phone, setPhone] = useState(initialData?.phone || "");
  const [groupName, setGroupName] = useState(initialData?.groupName || "第一组");
  const [address, setAddress] = useState(initialData?.address || "");
  const [memberCount, setMemberCount] = useState(
    initialData?.memberCount || 1
  );
  const [tags, setTags] = useState<Tag[]>(initialData?.tags || []);
  const [geocoding, setGeocoding] = useState(false);

  const toggleTag = (tag: Tag) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  // 地图选点后自动逆地理编码填充地址
  const handlePickAddress = (addr: string) => {
    setGeocoding(false);
    if (addr) {
      setAddress(addr);
    }
  };

  // 当 pickPosition 变化时标记正在编码
  useEffect(() => {
    if (pickPosition) {
      setGeocoding(true);
    }
  }, [pickPosition]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!headName.trim()) return;
    if (!pickPosition && !initialData) return;

    onSave({
      householdName: headName.trim() + "家",
      headName: headName.trim(),
      phone: phone.trim(),
      groupName,
      address: address.trim(),
      memberCount,
      tags,
      latitude: pickPosition?.lat?.toString() || initialData?.latitude || "0",
      longitude: pickPosition?.lng?.toString() || initialData?.longitude || "0",
    });
  };

  const groups = GROUP_NAMES;

  return (
    <div className="modal-layer" onClick={onClose}>
      <div className="household-form-modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>{initialData ? "编辑住户" : "新增住户"}</h2>
          <button className="close-button" aria-label="关闭" onClick={onClose}>
            <X size={20} />
          </button>
        </header>

        <div className="form-map-layout">
          {/* 左侧表单 */}
          <form className="form-left" onSubmit={handleSubmit}>
            <div className="form-field">
              <label>户主姓名</label>
              <input
                value={headName}
                onChange={(e) => setHeadName(e.target.value)}
                placeholder="请输入户主姓名"
                required
              />
            </div>

            <div className="form-field">
              <label>联系电话</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="请输入联系电话"
                type="tel"
              />
            </div>

            <div className="form-field">
              <label>所属组别</label>
              <div className="tag-select-group">
                {groups.map((g) => (
                  <button
                    key={g}
                    type="button"
                    className={`tag-select-btn ${groupName === g ? "active" : ""}`}
                    onClick={() => setGroupName(g)}
                  >
                    {groupName === g && <Check size={12} />}
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-field">
              <label>
                家庭地址
                {geocoding && (
                  <span style={{ marginLeft: 6, color: "#2f80ed", fontSize: 11 }}>
                    <Loader2 size={11} style={{ verticalAlign: "middle", animation: "spin 1s linear infinite" }} />
                    {" "}识别中...
                  </span>
                )}
              </label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={pickPosition ? "地图选点后自动识别" : "请输入家庭地址"}
              />
            </div>

            <div className="form-field">
              <label>家庭人数</label>
              <input
                type="number"
                min={1}
                value={memberCount}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setMemberCount(isNaN(n) ? 1 : Math.max(1, n));
                }}
              />
            </div>

            <div className="form-field">
              <label>特殊群体</label>
              <div className="tag-select-group">
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={`tag-select-btn ${tags.includes(tag) ? "active" : ""}`}
                    style={
                      tags.includes(tag)
                        ? {
                            background: getTagColor(tag),
                            color: "#fff",
                            borderColor: getTagColor(tag),
                          }
                        : {
                            color: getTagColor(tag),
                            borderColor: `${getTagColor(tag)}40`,
                          }
                    }
                    onClick={() => toggleTag(tag)}
                  >
                    {tags.includes(tag) && <Check size={12} />}
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: tags.includes(tag) ? "#fff" : getTagColor(tag),
                      }}
                    />
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-field">
              <label>地图定位</label>
              <div className="pick-location-hint">
                {pickPosition ? (
                  <span className="pick-done">
                    <MapPin size={14} />
                    已选择：{pickPosition.lng.toFixed(6)},{" "}
                    {pickPosition.lat.toFixed(6)}
                  </span>
                ) : (
                  <span className="pick-hint">
                    请在右侧地图上点击选择住户位置
                  </span>
                )}
              </div>
            </div>

            <button
              type="submit"
              className="save-button"
              disabled={!headName.trim() || (!pickPosition && !initialData)}
            >
              保存
            </button>
          </form>

          {/* 右侧地图 */}
          <div className="form-right">
            <MapContainer
              households={[]}
              selectedId={null}
              onSelect={() => {}}
              onMapClick={onMapClick}
              onPickAddress={handlePickAddress}
              pickingMode={true}
              pickPosition={pickPosition}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
