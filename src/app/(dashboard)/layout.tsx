"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { MobileNav } from "@/components/layout/MobileNav";

function MobileNavFallback() {
  return <nav className="mobile-nav" aria-hidden="true" />;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let redirected = false;
    const checkToken = () => {
      const token = localStorage.getItem("token");
      if (!token) {
        // 未登录直接跳转登录页，避免显示 404 / 空白页
        if (!redirected) {
          redirected = true;
          router.replace("/login");
        }
      } else {
        setReady(true);
      }
    };

    checkToken();

    // 监听 localStorage 变化（如其他标签页登录/退出）
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "token") {
        if (e.newValue) {
          setReady(true);
        } else {
          router.replace("/login");
        }
      }
    };

    // 部分自动化场景下 token 可能延迟写入，轮询 5 秒兜底
    let attempts = 0;
    const interval = setInterval(() => {
      if (ready) {
        clearInterval(interval);
        return;
      }
      attempts++;
      if (attempts > 10) {
        clearInterval(interval);
        return;
      }
      checkToken();
    }, 500);

    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
      clearInterval(interval);
    };
  }, [router, ready]);

  if (!ready) {
    // 加载中：显示简洁的过渡屏，不渲染侧边栏/底栏以免布局闪烁
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, color: "#8a95a8", fontSize: 14 }}>
        <div style={{ textAlign: "center" }}>加载中...</div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <section className="workspace">
        <Topbar />
        {children}
      </section>
      <Suspense fallback={<MobileNavFallback />}>
        <MobileNav />
      </Suspense>
    </div>
  );
}
