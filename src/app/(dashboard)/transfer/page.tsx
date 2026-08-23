"use client";

import { useState, useEffect } from "react";
import { Download, Upload, FileSpreadsheet, CheckCircle, XCircle, Loader2 } from "lucide-react";
import type { Household } from "@/types";
import { apiFetch, apiUrl } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

export default function TransferPage() {
  const { toast } = useToast();
  const [households, setHouseholds] = useState<Household[]>([]);
  const [loading, setLoading] = useState(true);

  // xlsx 导入状态
  const [xlsxImporting, setXlsxImporting] = useState(false);
  const [xlsxResult, setXlsxResult] = useState<{
    total: number;
    inserted: number;
    updated: number;
    skipped: number;
    failed: number;
    preview: Household[];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/households")
      .then((data) => {
        if (cancelled) return;
        setHouseholds(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error(err);
        toast("加载数据失败", "error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [toast]);

  function handleExport() {
    if (households.length === 0) return;

    const headers = [
      "ID",
      "户名",
      "户主姓名",
      "电话",
      "组别",
      "地址",
      "标记地址",
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
      h.markedAddress || "",
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
    toast("导出成功", "success");
  }

  function escapeCsv(val: string | number): string {
    const s = String(val);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  // xlsx 文件导入：直接上传到 /api/households/import 由服务端解析
  const handleXlsxChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    if (ext !== ".xlsx" && ext !== ".xls") {
      toast("仅支持 .xlsx / .xls 格式", "error");
      e.target.value = "";
      return;
    }

    setXlsxImporting(true);
    setXlsxResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const res = await fetch(apiUrl("/api/households/import"), {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || "导入失败");
      }

      setXlsxResult(data);
      toast(
        `导入完成：新增 ${data.inserted} 条，更新 ${data.updated} 条，跳过 ${data.skipped} 条，失败 ${data.failed} 条`,
        data.inserted > 0 || data.updated > 0 ? "success" : "error"
      );

      // 刷新列表
      apiFetch("/api/households")
        .then((d) => setHouseholds(Array.isArray(d) ? d : []))
        .catch(() => {});
    } catch (err) {
      toast(err instanceof Error ? err.message : "导入失败", "error");
    } finally {
      setXlsxImporting(false);
      e.target.value = "";
    }
  };

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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
          alignItems: "start",
        }}
      >
        {/* 导出卡片 */}
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

        {/* Excel 登记表导入卡片（三留守及独居老人信息登记表格式，与导出并排） */}
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            padding: "24px 24px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 14,
                background: "#e67e2215",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#e67e22",
                flexShrink: 0,
              }}
            >
              <FileSpreadsheet size={26} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#2b405b" }}>
                Excel 登记表导入
              </div>
              <div style={{ fontSize: 12, color: "#8a95a8" }}>
                支持《三留守及独居老人信息登记表》.xlsx 格式
              </div>
            </div>
          </div>

          <label
            style={{
              padding: "10px 24px",
              borderRadius: 10,
              border: "2px dashed #e67e22",
              background: "#fff8f0",
              color: "#e67e22",
              fontSize: 14,
              fontWeight: 600,
              cursor: xlsxImporting ? "wait" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              alignSelf: "center",
              opacity: xlsxImporting ? 0.6 : 1,
            }}
          >
            {xlsxImporting ? (
              <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
            ) : (
              <Upload size={16} />
            )}
            {xlsxImporting ? "导入中..." : "选择 xlsx 文件"}
            <input
              type="file"
              accept=".xlsx,.xls"
              style={{ display: "none" }}
              onChange={handleXlsxChange}
              disabled={xlsxImporting}
            />
          </label>

          <div
            style={{
              marginTop: 14,
              padding: "10px 14px",
              background: "#fff8f0",
              borderRadius: 8,
              border: "1px solid #ffe4c4",
              fontSize: 12,
              color: "#8a6d3b",
              lineHeight: 1.6,
            }}
          >
            已存在的住户（姓名+组别匹配）将更新数据；导入字段为空时保留原值，标签自动合并。
          </div>

          {/* xlsx 导入结果 */}
          {xlsxResult && (
            <div
              style={{
                marginTop: 16,
                padding: "14px 16px",
                background: "#f8f9fb",
                borderRadius: 10,
                border: "1px solid #e4e8ef",
              }}
            >
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                {xlsxResult.inserted > 0 && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "6px 12px",
                      borderRadius: 8,
                      background: "rgba(39,174,96,0.1)",
                      color: "#27ae60",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    <CheckCircle size={14} />
                    新增 {xlsxResult.inserted}
                  </div>
                )}
                {xlsxResult.updated > 0 && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "6px 12px",
                      borderRadius: 8,
                      background: "rgba(47,128,237,0.1)",
                      color: "#2f80ed",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    <CheckCircle size={14} />
                    更新 {xlsxResult.updated}
                  </div>
                )}
                {xlsxResult.skipped > 0 && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "6px 12px",
                      borderRadius: 8,
                      background: "rgba(242,153,74,0.1)",
                      color: "#f2994a",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    <XCircle size={14} />
                    跳过 {xlsxResult.skipped}
                  </div>
                )}
                {xlsxResult.failed > 0 && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "6px 12px",
                      borderRadius: 8,
                      background: "rgba(235,87,87,0.1)",
                      color: "#eb5757",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    <XCircle size={14} />
                    失败 {xlsxResult.failed}
                  </div>
                )}
                <span style={{ fontSize: 12, color: "#8a95a8", alignSelf: "center" }}>
                  共解析 {xlsxResult.total} 条
                </span>
              </div>

              {xlsxResult.preview && xlsxResult.preview.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#5a6577", marginBottom: 6 }}>
                    导入预览（最近 {xlsxResult.preview.length} 条）
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ color: "#8a95a8", textAlign: "left" }}>
                          <th style={{ padding: "4px 8px", fontWeight: 600 }}>户名</th>
                          <th style={{ padding: "4px 8px", fontWeight: 600 }}>组别</th>
                          <th style={{ padding: "4px 8px", fontWeight: 600 }}>电话</th>
                          <th style={{ padding: "4px 8px", fontWeight: 600 }}>分类</th>
                        </tr>
                      </thead>
                      <tbody>
                        {xlsxResult.preview.map((h) => (
                          <tr key={h.id} style={{ color: "#2b405b" }}>
                            <td style={{ padding: "4px 8px" }}>{h.householdName}</td>
                            <td style={{ padding: "4px 8px" }}>{h.groupName}</td>
                            <td style={{ padding: "4px 8px" }}>{h.phone || "—"}</td>
                            <td style={{ padding: "4px 8px" }}>
                              {h.tags.length > 0 ? h.tags.join("、") : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Responsive: stack on mobile */}
      <style>{`
        @media (max-width: 600px) {
          div[style*="grid-template-columns: 1fr 1fr"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
