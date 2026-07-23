"use client";

import { useState, useEffect } from "react";
import { Download, Upload, FileSpreadsheet } from "lucide-react";
import type { Household } from "@/types";
import { apiUrl } from "@/lib/api";

export default function TransferPage() {
  const [households, setHouseholds] = useState<Household[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(apiUrl("/api/households"));
        const data = await res.json();
        setHouseholds(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  function handleExport() {
    if (households.length === 0) return;

    const headers = [
      "ID",
      "户名",
      "户主姓名",
      "电话",
      "组别",
      "地址",
      "成员数",
      "标签",
      "纬度",
      "经度",
      "最近走访",
    ];

    const rows = households.map((h) => [
      h.id,
      h.householdName,
      h.headName,
      h.phone,
      h.groupName,
      h.address,
      h.memberCount,
      h.tags.join("|"),
      h.latitude,
      h.longitude,
      h.lastVisitAt ?? "",
    ]);

    const csvContent =
      "\uFEFF" +
      [headers.join(","), ...rows.map((r) => r.map(escapeCsv).join(","))].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `住户数据_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function escapeCsv(val: string | number): string {
    const s = String(val);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#8a95a8" }}>
        加载中...
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 24px", maxWidth: 900, margin: "0 auto" }}>
      <h1
        style={{
          fontSize: 22,
          fontWeight: 800,
          color: "#2b405b",
          margin: "0 0 20px",
        }}
      >
        导入导出
      </h1>

      <div className="transfer-grid-custom">
        {/* Export Card */}
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            padding: "28px 24px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "#2f80ed15",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#2f80ed",
              marginBottom: 16,
            }}
          >
            <Download size={26} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#2b405b", marginBottom: 6 }}>
            导出住户数据
          </div>
          <div style={{ fontSize: 13, color: "#8a95a8", marginBottom: 20 }}>
            将所有住户信息导出为 CSV 文件（共 {households.length} 条记录）
          </div>
          <button
            onClick={handleExport}
            disabled={households.length === 0}
            style={{
              padding: "10px 28px",
              borderRadius: 10,
              border: "none",
              background: households.length > 0 ? "#2f80ed" : "#c0c8d4",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: households.length > 0 ? "pointer" : "not-allowed",
            }}
          >
            导出 CSV
          </button>
        </div>

        {/* Import Card */}
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            padding: "28px 24px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "#27ae6015",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#27ae60",
              marginBottom: 16,
            }}
          >
            <Upload size={26} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#2b405b", marginBottom: 6 }}>
            导入住户数据
          </div>
          <div style={{ fontSize: 13, color: "#8a95a8", marginBottom: 20 }}>
            从 CSV 文件批量导入住户信息
          </div>
          <label
            style={{
              padding: "10px 28px",
              borderRadius: 10,
              border: "2px dashed #d0d5dd",
              background: "#fafbfc",
              color: "#5a6577",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <FileSpreadsheet size={16} />
            选择文件
            <input
              type="file"
              accept=".csv"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                setSelectedFile(file ? file.name : null);
              }}
            />
          </label>
          {selectedFile && (
            <div
              style={{
                marginTop: 12,
                fontSize: 13,
                color: "#27ae60",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <FileSpreadsheet size={14} />
              {selectedFile}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
