"use client";

import { HouseholdDrawer } from "@/components/map/HouseholdDrawer";
import { MapToolbar } from "@/components/map/MapToolbar";
import { MapContainer } from "@/components/map/MapContainer";
import type { RoutePlanParams } from "@/components/map/MapContainer";
import { HouseholdForm } from "@/components/household/HouseholdForm";
import { VisitForm } from "@/components/visit/VisitForm";
import { RoutePlan } from "@/components/map/RoutePlan";
import type { Household, Visit } from "@/types";
import { apiUrl, assetUrl } from "@/lib/api";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function MapPageContent() {
  const searchParams = useSearchParams();

  const [households, setHouseholds] = useState<Household[]>([]);
  const [selected, setSelected] = useState<Household | null>(null);
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showVisit, setShowVisit] = useState(false);
  const [showRoute, setShowRoute] = useState(false);
  const [pickingMode, setPickingMode] = useState(false);
  const [pickPosition, setPickPosition] = useState<{
    lng: number;
    lat: number;
  } | null>(null);
  const [routePlan, setRoutePlan] = useState<RoutePlanParams | null>(null);
  const [routeCount, setRouteCount] = useState(0);
  const [routeInfo, setRouteInfo] = useState<{
    distance: string;
    time: string;
  } | null>(null);
  const [navSteps, setNavSteps] = useState<string[]>([]);
  const [showNavPanel, setShowNavPanel] = useState(false);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [routeHouseholds, setRouteHouseholds] = useState<Household[]>([]);
  const [visitHousehold, setVisitHousehold] = useState<Household | null>(null);
  const [visitMode, setVisitMode] = useState(false);

  // 监听导航步骤事件
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.steps) {
        setNavSteps(detail.steps);
        setShowNavPanel(true);
      }
    };
    window.addEventListener("nav-ready", handler);
    return () => window.removeEventListener("nav-ready", handler);
  }, []);

  // 加载住户数据 + 走访记录（用于标记图片）
  useEffect(() => {
    Promise.all([
      fetch(apiUrl("/api/households")).then((r) => r.json()),
      fetch(apiUrl("/api/visits")).then((r) => r.json()),
    ])
      .then(([hData, vData]) => {
        if (Array.isArray(hData)) {
          const visits: Visit[] = Array.isArray(vData) ? vData : [];
          // 按时间倒序，取每个住户最近一张走访照片
          visits.sort(
            (a, b) =>
              new Date(b.createdAt || b.visitDate).getTime() -
              new Date(a.createdAt || a.visitDate).getTime()
          );
          const imageMap = new Map<number, string>();
          for (const v of visits) {
            if (imageMap.has(v.householdId)) continue;
            const imgs = Array.isArray(v.images) ? v.images : [];
            if (imgs.length > 0) {
              imageMap.set(v.householdId, assetUrl(imgs[0]));
            }
          }
          const enriched = hData.map((h: Household) =>
            imageMap.has(h.id) ? { ...h, lastVisitImage: imageMap.get(h.id) } : h
          );
          setHouseholds(enriched);
        } else {
          console.error("住户数据格式异常", hData);
        }
      })
      .catch(console.error);
  }, []);

  // URL 参数触发新增
  useEffect(() => {
    if (searchParams.get("add") === "1") {
      setShowAdd(true);
    }
  }, [searchParams]);

  // 监听全局搜索事件（来自 Topbar 搜索框）
  useEffect(() => {
    const handler = (e: Event) => {
      setSearch((e as CustomEvent).detail || "");
    };
    window.addEventListener("global-search", handler);
    return () => window.removeEventListener("global-search", handler);
  }, []);

  // 筛选逻辑
  const filtered = households.filter((h) => {
    const tags = Array.isArray(h.tags) ? h.tags : [];
    const matchTag =
      filterTags.length === 0 || tags.some((t) => filterTags.includes(t));
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      h.headName.toLowerCase().includes(q) ||
      h.householdName.toLowerCase().includes(q) ||
      h.phone.includes(q) ||
      h.groupName.includes(q);
    return matchTag && matchSearch;
  });

  const handleSelect = useCallback((family: Household) => {
    setSelected(family);
  }, []);

  const handleMapClick = useCallback((lng: number, lat: number) => {
    setPickPosition({ lng, lat });
  }, []);

  const handleSaveHousehold = async (data: Record<string, unknown>) => {
    try {
      const res = await fetch(apiUrl("/api/households"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const created = await res.json();
        setHouseholds((prev) => [...prev, created]);
        setShowAdd(false);
        setPickingMode(false);
        setPickPosition(null);
      } else if (res.status === 409) {
        const err = await res.json();
        alert(err.message || "该住户已存在");
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.message || "保存失败");
      }
    } catch (err) {
      console.error("保存失败", err);
      alert("网络错误，保存失败");
    }
  };

  const handleSaveVisit = async (data: Record<string, unknown>) => {
    try {
      const res = await fetch(apiUrl("/api/visits"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        setShowVisit(false);
        fetch(apiUrl("/api/households"))
          .then((r) => r.json())
          .then(setHouseholds);
      }
    } catch (err) {
      console.error("保存走访失败", err);
    }
  };

  const handleNavigate = (family: Household) => {
    const lng = family.longitude;
    const lat = family.latitude;
    const name = encodeURIComponent(family.householdName);
    window.open(
      `https://uri.amap.com/navigation?to=${lng},${lat},${name}`,
      "_blank"
    );
  };

  const handleRoutePlan = (params: RoutePlanParams, count: number, selectedHouseholds: Household[]) => {
    setRoutePlan(params);
    setRouteCount(count);
    setRouteHouseholds(selectedHouseholds);
    setShowRoute(false);
    // 进入走访模式，到达住户附近自动弹窗
    setVisitMode(true);
  };

  // 到达住户附近自动弹出走访弹窗
  const handleArriveHousehold = useCallback((family: Household) => {
    setSelected(family);
    setVisitHousehold(family);
    setShowVisit(true);
  }, []);

  const handleRouteComplete = (info: { distance: string; time: string } | null) => {
    if (info) {
      setRouteInfo(info);
    }
  };

  return (
    <div className="map-page">
      <MapToolbar
        filterTags={filterTags}
        onFilterChange={setFilterTags}
        resultCount={filtered.length}
        totalCount={households.length}
        onAddClick={() => {
          setShowAdd(true);
          setPickingMode(true);
        }}
        onRouteClick={() => setShowRoute(true)}
      />

      <div className="map-area">
        <MapContainer
          households={filtered}
          selectedId={selected?.id ?? null}
          onSelect={handleSelect}
          onMapClick={handleMapClick}
          pickingMode={pickingMode}
          pickPosition={pickPosition}
          routePlan={routePlan}
          onRouteComplete={handleRouteComplete}
          visitMode={visitMode}
          visitHouseholds={routeHouseholds}
          onArriveHousehold={handleArriveHousehold}
          searchKey={search}
        />

        {/* 搜索无结果提示 */}
        {(search || filterTags.length > 0) && filtered.length === 0 && (
          <div className="search-empty-overlay">
            <div className="search-empty-card">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#c4cdd8" strokeWidth="1.5">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <p>未找到匹配的住户</p>
              <span>
                {search && filterTags.length > 0
                  ? `关键词"${search}"与所选标签无交集`
                  : search
                  ? `没有包含"${search}"的住户`
                  : "所选标签下暂无住户"}
              </span>
              <button onClick={() => { setSearch(""); setFilterTags([]); }}>
                清除筛选
              </button>
            </div>
          </div>
        )}

        {/* 路线信息浮层 */}
        {routeInfo && routePlan && (
          <div className="route-info-overlay">
            <div className="route-info-card">
              <div className="route-info-header">
                <span>走访路线</span>
                <button onClick={() => {
                  setRoutePlan(null); setRouteInfo(null); setRouteCount(0);
                  setNavSteps([]); setShowNavPanel(false); setCurrentStepIdx(0);
                  setRouteHouseholds([]);
                  setVisitMode(false);
                  if (typeof window !== "undefined" && window.speechSynthesis) {
                    window.speechSynthesis.cancel();
                  }
                }}>✕</button>
              </div>
              <div className="route-info-stats">
                <div>
                  <strong>{routeInfo.distance}</strong>
                  <span>总距离</span>
                </div>
                <div>
                  <strong>{routeInfo.time}</strong>
                  <span>预计时间</span>
                </div>
                <div>
                  <strong>{routeCount} 户</strong>
                  <span>走访户数</span>
                </div>
              </div>

              {visitMode && (
                <div className="route-visit-tip">
                  走访模式已开启，到达住户附近将自动弹出走访表单
                </div>
              )}

              {navSteps.length > 0 && (
                <button className="nav-toggle-btn" onClick={() => setShowNavPanel(!showNavPanel)}>
                  {showNavPanel ? "收起导航步骤" : `查看${navSteps.length}个导航步骤`}
                </button>
              )}
              {showNavPanel && navSteps.length > 0 && (
                <div className="nav-steps-list">
                  {navSteps.map((step, idx) => {
                    const done = idx < currentStepIdx;
                    const active = idx === currentStepIdx;
                    return (
                      <div
                        key={idx}
                        className={`nav-step-item ${done ? "done" : ""} ${active ? "active" : ""}`}
                        onClick={() => setCurrentStepIdx(idx)}
                      >
                        <div className="nav-step-track">
                          <span className="nav-step-dot" />
                          {idx < navSteps.length - 1 && <span className="nav-step-line" />}
                        </div>
                        <span className="nav-step-text">{step}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {selected && (
        <>
          <div className="drawer-backdrop visible" onClick={() => setSelected(null)} />
          <HouseholdDrawer
            household={selected}
            onClose={() => setSelected(null)}
            onNavigate={() => handleNavigate(selected)}
            onAddVisit={() => setShowVisit(true)}
          />
        </>
      )}

      {showAdd && (
        <HouseholdForm
          pickPosition={pickPosition}
          onMapClick={handleMapClick}
          onSave={handleSaveHousehold}
          onClose={() => {
            setShowAdd(false);
            setPickingMode(false);
            setPickPosition(null);
          }}
        />
      )}

      {showVisit && (visitHousehold || selected) && (
        <VisitForm
          householdId={(visitHousehold || selected)!.id}
          householdName={(visitHousehold || selected)!.householdName}
          onSave={handleSaveVisit}
          onClose={() => { setShowVisit(false); setVisitHousehold(null); }}
        />
      )}

      {showRoute && (
        <RoutePlan
          households={households}
          onClose={() => setShowRoute(false)}
          onPlan={handleRoutePlan}
        />
      )}
    </div>
  );
}

export default function MapPage() {
  return (
    <Suspense fallback={<div className="map-page"><div className="map-area" style={{display:"grid",placeItems:"center",color:"#8a95a8"}}>加载中...</div></div>}>
      <MapPageContent />
    </Suspense>
  );
}
