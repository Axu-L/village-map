"use client";

import { useState, useEffect } from "react";
import { Download, Upload, FileSpreadsheet, CheckCircle, XCircle } from "lucide-react";
import type { Household } from "@/types";
import { apiUrl } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

interface ParsedRow {
  householdName: string;
  headName: string;
  phone: string;
  groupName: string;
  address: string;
  memberCount: number;
  tags: string[];
  latitude: string;
  longitude: string;
}

export default function TransferPage() {
  const { toast } = useToast();
  const [households, setHouseholds] = useState<Household[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: number;
    skipped: number;
    failed: number;
  } | null>(null);

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
    toast("导出成功", "success");
  }

  function escapeCsv(val: string | number): string {
    const s = String(val);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  // 解析 CSV 文件
  function parseCsv(text: string): ParsedRow[] {
    const lines = text.replace(/\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return [];

    // 跳过表头行（第 0 行），从第 1 行开始解析数据
    const dataLines = lines.slice(1);
    const rows: ParsedRow[] = [];

    for (const line of dataLines) {
      const cols = splitCsvLine(line);
      if (cols.length < 10) continue;

      // 列顺序与导出一致：ID, 户名, 户主姓名, 电话, 组别, 地址, 成员数, 标签, 纬度, 经度, 最近走访
      const headName = (cols[2] || "").trim();
      const phone = (cols[3] || "").trim();
      const groupName = (cols[4] || "").trim();
      const address = (cols[5] || "").trim();
      if (!headName || !phone || !groupName || !address) continue;

      rows.push({
        householdName: (cols[1] || "").trim() || `${headName}家`,
        headName,
        phone,
        groupName,
        address,
        memberCount: Number(cols[6]) || 1,
        tags: (cols[7] || "").split("|").map((t) => t.trim()).filter(Boolean),
        latitude: (cols[8] || "0").trim(),
        longitude: (cols[9] || "0").trim(),
      });
    }
    return rows;
  }

  // 处理含引号的 CSV 行
  function splitCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file.name);
    setImportResult(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = String(event.target?.result || "");
      const parsed = parseCsv(text);
      setPreviewRows(parsed);
      if (parsed.length === 0) {
        toast("未解析到有效数据，请检查 CSV 格式", "error");
      } else {
        toast(`已解析 ${parsed.length} 条记录，请确认导入`, "success");
      }
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  };

  const handleImport = async () => {
    if (previewRows.length === 0) return;
    setImporting(true);
    let success = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of previewRows) {
      try {
        const res = await fetch(apiUrl("/api/households"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(row),
        });
        if (res.ok) {
          success++;
        } else if (res.status === 409) {
          skipped++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    setImporting(false);
    setImportResult({ success, skipped, failed });
    toast(`导入完成：成功 ${success} 条，跳过 ${skipped} 条，失败 ${failed} 条`, success > 0 ? "success" : "error");

    // 刷新列表
    fetch(apiUrl("/api/households"))
      .then((r) => r.json())
      .then((data) => setHouseholds(Array.isArray(data) ? data : []))
      .catch(() => {});

    // 清理
    setPreviewRows([]);
    setSelectedFile(null);
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
        }}
      >
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
            从 CSV 文件批量导入住户信息（格式需与导出一致）
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
              onChange={handleFileChange}
            />
          </label>

          {/* 预览解析结果 */}
          {previewRows.length > 0 && (
            <div style={{ marginTop: 16, width: "100%", textAlign: "left" }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#2b405b",
                  marginBottom: 8,
                }}
              >
                预览（前 5 条 / 共 {previewRows.length} 条）
              </div>
              <div
                style={{
                  background: "#f8f9fb",
                  borderRadius: 8,
                  padding: 10,
                  maxHeight: 200,
                  overflowY: "auto",
                  border: "1px solid #e4e8ef",
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 12,
                  }}
                >
                  <thead>
                    <tr style={{ color: "#8a95a8", textAlign: "left" }}>
                      <th style={{ padding: "4px 8px", fontWeight: 600 }}>户名</th>
                      <th style={{ padding: "4px 8px", fontWeight: 600 }}>户主</th>
                      <th style={{ padding: "4px 8px", fontWeight: 600 }}>电话</th>
                      <th style={{ padding: "4px 8px", fontWeight: 600 }}>组别</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.slice(0, 5).map((row, idx) => (
                      <tr key={idx} style={{ color: "#2b405b" }}>
                        <td style={{ padding: "4px 8px" }}>{row.householdName}</td>
                        <td style={{ padding: "4px 8px" }}>{row.headName}</td>
                        <td style={{ padding: "4px 8px" }}>{row.phone}</td>
                        <td style={{ padding: "4px 8px" }}>{row.groupName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                onClick={handleImport}
                disabled={importing}
                style={{
                  marginTop: 12,
                  width: "100%",
                  padding: "10px 0",
                  border: "none",
                  borderRadius: 8,
                  background: importing
                    ? "#b0b8c4"
                    : "linear-gradient(135deg, #27ae60, #2f80ed)",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: importing ? "not-allowed" : "pointer",
                }}
              >
                {importing
                  ? `导入中...`
                  : `确认导入 ${previewRows.length} 条`}
              </button>
            </div>
          )}

          {/* 导入结果 */}
          {importResult && (
            <div
              style={{
                marginTop: 16,
                width: "100%",
                display: "flex",
                gap: 8,
                justifyContent: "center",
              }}
            >
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
                成功 {importResult.success}
              </div>
              {importResult.skipped > 0 && (
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
                  跳过 {importResult.skipped}
                </div>
              )}
              {importResult.failed > 0 && (
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
                  失败 {importResult.failed}
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
