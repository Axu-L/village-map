"use client";

import { FormEvent, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MapPin } from "lucide-react";
import { apiUrl } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 已登录用户直接跳转工作台，避免重复看到登录页
  useEffect(() => {
    if (localStorage.getItem("token")) {
      router.replace("/map");
    }
  }, [router]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(apiUrl("/api/auth"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        router.push("/map");
      } else {
        const data = await res.json();
        setError(data.message || "登录失败");
      }
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* 背景装饰 */}
      <div className="login-bg" />

      {/* 登录卡片 */}
      <div className="login-card">
        <div className="login-logo">
          <div className="brand-mark-large">
            <MapPin size={28} fill="currentColor" />
          </div>
          <div>
            <h1 className="login-title">村智图</h1>
            <p className="login-subtitle">VillageMap</p>
          </div>
        </div>
        <p className="login-desc">花园村重点人群数字化管理平台</p>

        <form onSubmit={handleLogin}>
          <div className="login-field">
            <label>用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
              autoComplete="username"
            />
          </div>
          <div className="login-field">
            <label>密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              autoComplete="current-password"
            />
          </div>

          {error && <p className="login-error">{error}</p>}

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? "登录中..." : "登 录"}
          </button>
        </form>

        <p className="login-hint">演示账号：admin / admin123</p>
      </div>
    </div>
  );
}
