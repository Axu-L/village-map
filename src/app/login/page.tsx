"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin } from "lucide-react";
import { apiUrl } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

      <style jsx>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
        }
        .login-bg {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, #1a5c3a 0%, #2f80ed 50%, #1a5c3a 100%);
          z-index: 0;
        }
        .login-bg::before {
          content: "";
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 40%;
          background: linear-gradient(0deg, rgba(39, 174, 96, 0.3) 0%, transparent 100%);
        }
        .login-bg::after {
          content: "";
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 200px;
          background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 200'%3E%3Cpath fill='%2327AE6015' d='M0 200V80c120-40 240 20 360-10s240-60 360-30 240 50 360 20 240-70 360-40v180z'/%3E%3Cpath fill='%2327AE6010' d='M0 200V120c120-20 240 40 360 10s240-70 360-40 240 30 360 10 240-60 360-30v130z'/%3E%3C/svg%3E") no-repeat bottom center;
          background-size: cover;
        }
        .login-card {
          position: relative;
          z-index: 1;
          width: min(420px, 90vw);
          padding: 40px 36px;
          background: rgba(255, 255, 255, 0.95);
          border-radius: 20px;
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.25);
          backdrop-filter: blur(10px);
        }
        .login-logo {
          display: flex;
          align-items: center;
          gap: 14px;
          justify-content: center;
          margin-bottom: 8px;
        }
        .brand-mark-large {
          width: 52px;
          height: 52px;
          display: grid;
          place-items: center;
          color: #fff;
          background: linear-gradient(145deg, #45a873, #188d4f);
          border-radius: 16px 16px 16px 4px;
          box-shadow: 0 8px 20px rgba(39, 174, 96, 0.3);
        }
        .login-title {
          margin: 0;
          font-size: 28px;
          font-weight: 800;
          color: #1a3150;
          letter-spacing: 0.05em;
        }
        .login-subtitle {
          margin: 2px 0 0;
          font-size: 12px;
          color: #8a95a8;
          letter-spacing: 0.1em;
        }
        .login-desc {
          text-align: center;
          margin: 12px 0 28px;
          color: #68758a;
          font-size: 14px;
        }
        .login-field {
          margin-bottom: 16px;
        }
        .login-field label {
          display: block;
          margin-bottom: 6px;
          color: #536177;
          font-size: 12px;
          font-weight: 600;
        }
        .login-field input {
          width: 100%;
          height: 44px;
          padding: 0 14px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          font-size: 14px;
          color: #30405c;
          background: #f9fbfd;
          outline: none;
          transition: border-color 0.2s;
        }
        .login-field input:focus {
          border-color: #2f80ed;
          box-shadow: 0 0 0 3px rgba(47, 128, 237, 0.1);
        }
        .login-error {
          margin: 0 0 12px;
          color: #eb5757;
          font-size: 12px;
          text-align: center;
        }
        .login-button {
          width: 100%;
          height: 46px;
          margin-top: 8px;
          border: 0;
          border-radius: 10px;
          color: #fff;
          background: linear-gradient(135deg, #27ae60, #2f80ed);
          font-size: 16px;
          font-weight: 700;
          letter-spacing: 0.1em;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        .login-button:hover {
          opacity: 0.9;
        }
        .login-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .login-hint {
          text-align: center;
          margin: 20px 0 0;
          color: #aab3c0;
          font-size: 11px;
        }
      `}</style>
    </div>
  );
}
