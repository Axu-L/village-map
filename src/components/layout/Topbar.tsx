"use client";

import { Bell, MapPin, Search, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// 全局搜索事件，地图页面监听此事件
export function emitGlobalSearch(value: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("global-search", { detail: value }));
  }
}

interface LocationTip {
  name: string;
  district: string;
  adcode: string;
}

export function Topbar() {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [tips, setTips] = useState<LocationTip[]>([]);
  const [showTips, setShowTips] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const autoCompleteRef = useRef<any>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  };

  // 懒加载 AutoComplete 插件（首次输入时才加载，避免非地图页面的无效开销）
  const ensureAutoComplete = async () => {
    if (autoCompleteRef.current) return autoCompleteRef.current;
    const AMapLoader = (await import("@amap/amap-jsapi-loader")).default;
    window._AMapSecurityConfig = {
      securityJsCode: process.env.NEXT_PUBLIC_AMAP_SECRET!,
    };
    const AMap = await AMapLoader.load({
      key: process.env.NEXT_PUBLIC_AMAP_KEY!,
      version: "2.0",
      plugins: ["AMap.AutoComplete"],
    });
    AMap.getConfig().appname = "amap-jsapi-skill";
    autoCompleteRef.current = new AMap.AutoComplete({ datatype: "poi" });
    return autoCompleteRef.current;
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setKeyword(value);
    emitGlobalSearch(value);

    const trimmed = value.trim();
    if (trimmed.length > 1) {
      ensureAutoComplete()
        .then((auto) => {
          auto.search(trimmed, (status: string, result: any) => {
            if (status === "complete" && result?.tips?.length) {
              const valid: LocationTip[] = result.tips
                .filter((t: any) => t.name && t.district)
                .slice(0, 6)
                .map((t: any) => ({
                  name: t.name,
                  district: t.district,
                  adcode: t.adcode || "",
                }));
              setTips(valid);
              setShowTips(valid.length > 0);
            } else {
              setTips([]);
              setShowTips(false);
            }
          });
        })
        .catch((err) => console.error("AutoComplete 加载失败", err));
    } else {
      setTips([]);
      setShowTips(false);
    }
  };

  const handleSelectTip = (tip: LocationTip) => {
    setKeyword(tip.name);
    setShowTips(false);
    // 派发定位事件，MapContainer 监听后调用 PlaceSearch 定位并打标记
    window.dispatchEvent(new CustomEvent("map-locate", { detail: tip }));
  };

  // 点击外部关闭下拉
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (
        searchWrapRef.current &&
        !searchWrapRef.current.contains(e.target as Node)
      ) {
        setShowTips(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <header className="topbar">
      <div className="mobile-brand">
        <div className="brand-mark"><MapPin size={17} fill="currentColor" /></div>
        <b>村智图</b>
      </div>
      <div
        className="header-search"
        ref={searchWrapRef}
        style={{ position: "relative" }}
      >
        <Search size={18} />
        <input
          value={keyword}
          placeholder="搜索姓名、电话、组别或位置"
          onChange={handleSearch}
          onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
          onFocus={() => { if (tips.length) setShowTips(true); }}
        />
        {showTips && tips.length > 0 && (
          <ul className="search-tips-dropdown">
            {tips.map((tip, idx) => (
              <li key={idx} onClick={() => handleSelectTip(tip)}>
                <MapPin size={14} />
                <div className="tip-text">
                  <div className="tip-name">{tip.name}</div>
                  <div className="tip-district">{tip.district}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="top-actions">
        <button className="icon-button notification"><Bell size={19} /><i /></button>
        <button className="profile" onClick={handleLogout} title="退出登录">
          <span>管</span>
          <strong>管理员</strong>
          <LogOut size={15} />
        </button>
      </div>
    </header>
  );
}
