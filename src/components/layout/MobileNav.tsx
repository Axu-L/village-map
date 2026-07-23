"use client";

import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { BarChart3, Home, Menu, Plus, Users } from "lucide-react";

const mobileNavItems = [
  { href: "/map", label: "地图", icon: Home },
  { href: "/people", label: "人员", icon: Users },
  { href: "/map?add=1", label: "新增", icon: Plus, isAdd: true },
  { href: "/statistics", label: "统计", icon: BarChart3 },
  { href: "/settings", label: "我的", icon: Menu },
];

export function MobileNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isActive = (href: string) => {
    const [path, query] = href.split("?");
    if (pathname !== path) return false;
    if (!query) return true;
    const params = new URLSearchParams(query);
    for (const [key, value] of params.entries()) {
      if (searchParams.get(key) !== value) return false;
    }
    return true;
  };

  return (
    <nav className="mobile-nav" aria-label="移动端导航">
      {mobileNavItems.map(({ href, label, icon: Icon, isAdd }) => (
        <Link
          key={label}
          href={href}
          className={isAdd ? "mobile-add" : isActive(href) ? "active" : ""}
        >
          <Icon size={20} />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
