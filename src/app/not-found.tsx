import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 16,
      color: "#2b405b",
    }}>
      <h1 style={{ fontSize: 72, margin: 0, fontWeight: 800, color: "#2f80ed" }}>404</h1>
      <p style={{ fontSize: 16, color: "#8a95a8" }}>页面不存在</p>
      <Link href="/map" style={{
        padding: "10px 24px",
        borderRadius: 10,
        background: "linear-gradient(135deg, #27ae60, #2f80ed)",
        color: "white",
        textDecoration: "none",
        fontWeight: 700,
        fontSize: 14,
      }}>
        返回首页
      </Link>
    </div>
  );
}
