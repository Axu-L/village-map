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
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkToken = () => {
      const token = localStorage.getItem("token");
      if (!token) {
        setReady(false);
      } else {
        setReady(true);
      }
      setChecking(false);
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
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, color: "#8a95a8", fontSize: 14 }}>
        <div style={{ textAlign: "center" }}>
          {checking ? "加载中..." : "未登录，请重新登录"}
          {!checking && (
            <button
              onClick={() => router.push("/login")}
              style={{
                display: "block",
                margin: "12px auto 0",
                padding: "8px 20px",
                border: "none",
                borderRadius: 8,
                background: "#2f80ed",
                color: "#fff",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              去登录
            </button>
          )}
        </div>
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
