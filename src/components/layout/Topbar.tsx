"use client";

import { Bell, ChevronDown, MapPin, Search, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

// 全局搜索事件，地图页面监听此事件
export function emitGlobalSearch(value: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("global-search", { detail: value }));
  }
}

export function Topbar() {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    emitGlobalSearch(e.target.value);
  };

  return (
    <header className="topbar">
      <div className="mobile-brand">
        <div className="brand-mark"><MapPin size={17} fill="currentColor" /></div>
        <b>村智图</b>
      </div>
      <div className="header-search">
        <Search size={18} />
        <input
          placeholder="搜索姓名、电话或组别"
          onChange={handleSearch}
          onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
        />
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
