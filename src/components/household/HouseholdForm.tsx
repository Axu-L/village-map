"use client";

import { useState, FormEvent, useEffect, useRef } from "react";
import { allTags, getTagColor } from "@/lib/tags";
import { X, MapPin, Check, Loader2, ChevronDown, Minus, Plus } from "lucide-react";
import { MapContainer } from "@/components/map/MapContainer";
import { GROUP_NAMES } from "@/lib/constants";
import { DEFAULT_CENTER } from "@/lib/amap";
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
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const tagDropdownRef = useRef<HTMLDivElement>(null);

  const toggleTag = (tag: Tag) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  // 点击外部关闭特殊群体下拉
  useEffect(() => {
    if (!tagDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target as Node)) {
        setTagDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [tagDropdownOpen]);

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

  // 新增住户时默认填充当前定位位置（编辑流程有 initialData 不触发）
  // 优先用浏览器定位；iOS 非 HTTPS 等场景下定位会被静默屏蔽，6 秒兜底回退到村庄默认中心
  useEffect(() => {
    if (initialData) return; // 仅新增
    if (pickPosition) return; // 已有位置不覆盖

    let resolved = false;
    const fill = (lng: number, lat: number) => {
      if (resolved) return;
      resolved = true;
      onMapClick(lng, lat);
    };

    // 兜底定时器：6 秒未拿到定位则回退默认中心
    const timer = setTimeout(() => {
      fill(DEFAULT_CENTER[0], DEFAULT_CENTER[1]);
    }, 6000);

    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fill(pos.coords.longitude, pos.coords.latitude),
        () => fill(DEFAULT_CENTER[0], DEFAULT_CENTER[1]),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      fill(DEFAULT_CENTER[0], DEFAULT_CENTER[1]);
    }

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

            {/* 一行三列：所属组别 / 特殊群体 / 家庭人数 */}
            <div className="form-row-3">
              {/* 所属组别 —— 下拉 */}
              <div className="form-field">
                <label>所属组别</label>
                <div className="select-wrap">
                  <select
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                  >
                    {groups.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="select-arrow" />
                </div>
              </div>

              {/* 特殊群体 —— 多选下拉 */}
              <div className="form-field" ref={tagDropdownRef}>
                <label>特殊群体</label>
                <button
                  type="button"
                  className={`multi-select-trigger ${tagDropdownOpen ? "open" : ""}`}
                  onClick={() => setTagDropdownOpen((v) => !v)}
                >
                  <span className="multi-select-value">
                    {tags.length === 0 ? (
                      <span className="multi-select-placeholder">请选择</span>
                    ) : (
                      <span className="multi-select-chips">
                        {tags.slice(0, 2).map((t) => (
                          <span
                            key={t}
                            className="multi-select-chip"
                            style={{
                              background: `${getTagColor(t)}18`,
                              color: getTagColor(t),
                            }}
                          >
                            {t}
                          </span>
                        ))}
                        {tags.length > 2 && (
                          <span className="multi-select-chip multi-select-more">
                            +{tags.length - 2}
                          </span>
                        )}
                      </span>
                    )}
                  </span>
                  <ChevronDown size={14} className="select-arrow" />
                </button>
                {tagDropdownOpen && (
                  <div className="multi-select-dropdown">
                    {allTags.map((tag) => {
                      const checked = tags.includes(tag);
                      const color = getTagColor(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          className={`multi-select-option ${checked ? "checked" : ""}`}
                          onClick={() => toggleTag(tag)}
                        >
                          <span
                            className="multi-select-dot"
                            style={{ background: color }}
                          />
                          <span className="multi-select-label">{tag}</span>
                          <span className={`multi-select-checkbox ${checked ? "checked" : ""}`}>
                            {checked && <Check size={12} />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 家庭人数 —— 步进器 */}
              <div className="form-field">
                <label>家庭人数</label>
                <div className="stepper">
                  <button
                    type="button"
                    className="stepper-btn"
                    onClick={() => setMemberCount((n) => Math.max(1, n - 1))}
                    disabled={memberCount <= 1}
                    aria-label="减少"
                  >
                    <Minus size={14} />
                  </button>
                  <input
                    type="number"
                    min={1}
                    value={memberCount}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      setMemberCount(isNaN(n) || n < 1 ? 1 : n);
                    }}
                  />
                  <button
                    type="button"
                    className="stepper-btn"
                    onClick={() => setMemberCount((n) => n + 1)}
                    aria-label="增加"
                  >
                    <Plus size={14} />
                  </button>
                </div>
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
