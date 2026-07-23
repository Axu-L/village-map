"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  BarChart3,
  ChevronDown,
  ClipboardList,
  FileUp,
  Home,
  MapPin,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";

const navItems = [
  { id: "map", href: "/map", label: "地图工作台", icon: Home },
  { id: "people", href: "/people", label: "人员管理", icon: Users },
  { id: "visits", href: "/visits", label: "入户记录", icon: ClipboardList },
  { id: "statistics", href: "/statistics", label: "数据统计", icon: BarChart3 },
  { id: "transfer", href: "/transfer", label: "导入导出", icon: FileUp },
  { id: "settings", href: "/settings", label: "系统设置", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="brand-lockup">
        <div className="brand-mark"><MapPin size={20} fill="currentColor" /></div>
        <div><b>村智图</b><span>花园村重点人群管理平台</span></div>
      </div>
      <nav className="main-nav" aria-label="主菜单">
        <p className="nav-label">工作台</p>
        {navItems.map(({ id, href, label, icon: Icon }) => (
          <Link
            key={id}
            href={href}
            className={`nav-item ${pathname === href || (pathname?.startsWith(href + "/")) ? "active" : ""}`}
          >
            <Icon size={19} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="security-note"><ShieldCheck size={17} /><span>数据安全保护中</span></div>
        <button className="village-switch" disabled title="多村庄切换功能开发中">花园村村委会 <ChevronDown size={15} /></button>
      </div>
    </aside>
  );
}
