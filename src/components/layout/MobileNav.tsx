"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { BarChart3, Home, Plus, Settings, Users } from "lucide-react";

const mobileNavItems = [
  { href: "/map", label: "地图", icon: Home },
  { href: "/people", label: "人员", icon: Users },
  { href: "/map", label: "新增", icon: Plus, isAdd: true },
  { href: "/statistics", label: "统计", icon: BarChart3 },
  { href: "/settings", label: "我的", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();

  const handleAddClick = (e: React.MouseEvent) => {
    e.preventDefault();
    // 加时间戳强制触发 useSearchParams 变化，即使在同一路由也能打开新增弹窗
    router.push(`/map?add=1&_t=${Date.now()}`);
  };

  return (
    <nav className="mobile-nav" aria-label="移动端导航">
      {mobileNavItems.map(({ href, label, icon: Icon, isAdd }) => (
        <Link
          key={label}
          href={href}
          className={isAdd ? "mobile-add" : pathname === href ? "active" : ""}
          onClick={isAdd ? handleAddClick : undefined}
        >
          <Icon size={20} />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
