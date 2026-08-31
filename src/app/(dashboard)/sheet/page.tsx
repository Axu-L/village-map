"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Search, Loader2, ExternalLink, Table2, MapPin, Plus, Save, Trash2, PaintBucket } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { MapContainer } from "@/components/map/MapContainer";
import { apiFetch } from "@/lib/api";
import { GROUP_NAMES } from "@/lib/constants";
import { allTags, getTagColor } from "@/lib/tags";
import { validatePhone } from "@/lib/validate";
import type { Household, Tag } from "@/types";

// 表格行类型：住户数据 + 新增行标记
type SheetRow = Household & { isNew?: boolean };

// 可编辑文本列（支持单击编辑 + 拖拽框选批量填充）
const FIELDS: { field: Field; label: string; width: number; numeric?: boolean }[] = [
  { field: "householdName", label: "户名", width: 130 },
  { field: "headName", label: "户主姓名", width: 110 },
  { field: "phone", label: "联系电话", width: 130 },
  { field: "groupName", label: "组别", width: 100 },
  { field: "address", label: "住址", width: 200 },
  { field: "memberCount", label: "家庭人数", width: 90, numeric: true },
];
type Field = "householdName" | "headName" | "phone" | "groupName" | "address" | "memberCount";

// 单元格值校验
function validateFieldValue(field: Field, value: string): string | null {
  switch (field) {
    case "headName":
      return value.trim() ? null : "户主姓名不能为空";
    case "phone":
      return validatePhone(value) ? null : "手机号格式不正确";
    case "groupName":
      return (GROUP_NAMES as readonly string[]).includes(value) ? null : "组别不合法";
    case "address":
      return value.trim() ? null : "住址不能为空";
    case "memberCount": {
      const n = Number(value);
      return Number.isInteger(n) && n >= 1 && n <= 50 ? null : "家庭人数须为 1-50 的整数";
    }
    default:
      return null;
  }
}

// 框选范围（行/列索引，均为闭区间）
type Range = { r1: number; r2: number; c1: number; c2: number };
const normRange = (a: { r: number; c: number }, b: { r: number; c: number }): Range => ({
  r1: Math.min(a.r, b.r),
  r2: Math.max(a.r, b.r),
  c1: Math.min(a.c, b.c),
  c2: Math.max(a.c, b.c),
});

// 坐标是否已标记（排除 0 / 空）
function hasPosition(h: Household): boolean {
  const lat = Number(h.latitude);
  const lng = Number(h.longitude);
  return !isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0);
}

export default function SheetPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [savingCount, setSavingCount] = useState(0);

  // 单击编辑的单元格
  const [editing, setEditing] = useState<{ rowId: number; field: Field } | null>(null);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  // 拖拽框选
  const [rangeSel, setRangeSel] = useState<Range | null>(null);
  const [batchValue, setBatchValue] = useState("");
  const batchInputRef = useRef<HTMLInputElement | null>(null);

  // 标签弹层（点击标签单元格打开）
  const [tagRowId, setTagRowId] = useState<number | null>(null);

  // 行选中（点击行号）
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SheetRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 位置标记弹窗
  const [pickingRow, setPickingRow] = useState<SheetRow | null>(null);
  const [pickPos, setPickPos] = useState<{ lng: number; lat: number } | null>(null);
  const [savingPosition, setSavingPosition] = useState(false);

  // 新增住户
  const [newRowModalOpen, setNewRowModalOpen] = useState(false);
  const [pendingNewRows, setPendingNewRows] = useState<SheetRow[]>([]);
  const [newRowSaving, setNewRowSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/households")
      .then((data) => {
        if (cancelled) return;
        setRows(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error(err);
        toast("加载数据失败", "error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((h) => {
      const tags = Array.isArray(h.tags) ? h.tags : [];
      return (
        h.householdName.toLowerCase().includes(q) ||
        h.headName.toLowerCase().includes(q) ||
        h.phone.includes(q) ||
        h.groupName.toLowerCase().includes(q) ||
        h.address.toLowerCase().includes(q) ||
        String(h.memberCount).includes(q) ||
        tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [rows, search]);

  // 编辑态聚焦并全选
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  // Esc 清除框选 / 标签弹层
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (editing) return; // 输入框自己的 Esc 处理
      if (tagRowId !== null) setTagRowId(null);
      else if (rangeSel) setRangeSel(null);
      else if (selectedRowId !== null) setSelectedRowId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, tagRowId, rangeSel, selectedRowId]);

  // ── 单元格编辑 ─────────────────────────────────────────
  const beginEdit = useCallback((r: number, c: number) => {
    const row = filtered[r];
    if (!row) return;
    const field = FIELDS[c].field;
    setEditing({ rowId: row.id, field });
    setDraft(String(row[field] ?? ""));
  }, [filtered]);

  const commitEdit = useCallback(async () => {
    if (!editing) return;
    const { rowId, field } = editing;
    setEditing(null);
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;
    const value = draft.trim();
    const original = String(row[field] ?? "");
    if (value === original) return;

    // 新增行：仅本地更新
    if (row.isNew) {
      setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, [field]: value } : r)));
      return;
    }

    const err = validateFieldValue(field, value);
    if (err) {
      toast(err, "error");
      return;
    }
    const typed = field === "memberCount" ? Number(value) : value;
    const snapshot = row;
    setRows((prev) => prev.map((r) => (r.id === rowId ? ({ ...r, [field]: typed } as SheetRow) : r)));
    setSavingCount((n) => n + 1);
    try {
      const saved = await apiFetch(`/api/households/${rowId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: typed }),
      });
      setRows((prev) => prev.map((r) => (r.id === rowId ? saved : r)));
      toast("已保存", "success");
    } catch (e) {
      setRows((prev) => prev.map((r) => (r.id === rowId ? snapshot : r)));
      toast(e instanceof Error ? e.message : "保存失败", "error");
    } finally {
      setSavingCount((n) => n - 1);
    }
  }, [editing, draft, rows, toast]);

  // ── 拖拽框选 ─────────────────────────────────────────────
  // mousedown 记录起点；移动超过一格即进入框选；未移动松开 = 单击编辑
  const cellMouseDown = (r: number, c: number, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const t = e.target as HTMLElement;
    if (t.closest("input,select,button,a")) return;
    e.preventDefault();
    const start = { r, c };
    let moved = false;
    const move = (ev: MouseEvent) => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
      const cell = el?.closest("[data-r]") as HTMLElement | null;
      if (!cell || cell.dataset.r === undefined) return;
      const cr = Number(cell.dataset.r);
      const cc = Number(cell.dataset.c);
      if (cr !== start.r || cc !== start.c) moved = true;
      if (moved) setRangeSel(normRange(start, { r: cr, c: cc }));
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      if (moved) {
        setEditing(null);
        setTagRowId(null);
        // 聚焦批量填充输入框
        setTimeout(() => batchInputRef.current?.focus(), 0);
      } else {
        setRangeSel(null);
        setTagRowId(null);
        beginEdit(r, c);
      }
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  // 框选批量填充：将输入值应用到范围内所有可编辑单元格
  const applyBatch = async () => {
    if (!rangeSel) return;
    const val = batchValue.trim();
    if (!val) {
      toast("请输入要填充的值", "error");
      return;
    }
    // 先做整体验验
    const jobs: { row: SheetRow; field: Field; value: string | number }[] = [];
    for (let r = rangeSel.r1; r <= rangeSel.r2; r++) {
      for (let c = rangeSel.c1; c <= rangeSel.c2; c++) {
        const row = filtered[r];
        if (!row || row.isNew) continue;
        const field = FIELDS[c].field;
        const err = validateFieldValue(field, val);
        if (err) {
          toast(`【${FIELDS[c].label}】${err}`, "error");
          return;
        }
        jobs.push({ row, field, value: field === "memberCount" ? Number(val) : val });
      }
    }
    if (jobs.length === 0) {
      toast("范围内没有可填充的单元格", "error");
      return;
    }
    // 乐观更新
    setRows((prev) =>
      prev.map((r) => {
        const job = jobs.find((j) => j.row.id === r.id);
        return job ? ({ ...r, [job.field]: job.value } as SheetRow) : r;
      })
    );
    setSavingCount((n) => n + 1);
    let ok = 0;
    let fail = 0;
    await Promise.all(
      jobs.map(async (j) => {
        try {
          await apiFetch(`/api/households/${j.row.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ [j.field]: j.value }),
          });
          ok++;
        } catch {
          fail++;
        }
      })
    );
    setSavingCount((n) => n - 1);
    if (fail > 0) {
      // 有失败：拉取服务端数据恢复真实状态
      const data = await apiFetch("/api/households").catch(() => null);
      if (Array.isArray(data)) setRows(data);
      toast(`${fail} 个单元格保存失败，已还原`, "error");
    } else {
      toast(`已填充 ${ok} 个单元格`, "success");
    }
    setRangeSel(null);
    setBatchValue("");
  };

  // ── 标签 ─────────────────────────────────────────────
  const toggleTag = async (row: SheetRow, tag: Tag) => {
    const current = Array.isArray(row.tags) ? row.tags : [];
    const next = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
    if (row.isNew) {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, tags: next } : r)));
      return;
    }
    const snapshot = row;
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, tags: next } : r)));
    setSavingCount((n) => n + 1);
    try {
      const saved = await apiFetch(`/api/households/${row.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: next }),
      });
      setRows((prev) => prev.map((r) => (r.id === row.id ? saved : r)));
    } catch (e) {
      setRows((prev) => prev.map((r) => (r.id === row.id ? snapshot : r)));
      toast(e instanceof Error ? e.message : "保存失败", "error");
    } finally {
      setSavingCount((n) => n - 1);
    }
  };

  // ── 新增行 ─────────────────────────────────────────────
  const addBlankRow = useCallback(() => {
    const tempId = -Date.now();
    setRows((prev) => [
      {
        id: tempId,
        householdName: "",
        headName: "",
        phone: "",
        groupName: "第一组",
        address: "",
        markedAddress: null,
        memberCount: 1,
        tags: [],
        latitude: "0",
        longitude: "0",
        lastVisitAt: null,
        isNew: true,
      },
      ...prev,
    ]);
    setSearch("");
    toast("已在顶部添加空白行，填写后点击「保存新增住户」", "success");
  }, [toast]);

  const newRows = rows.filter((r) => r.isNew);

  const openNewRowModal = () => {
    const invalid = newRows.find((r) => !r.headName.trim() || !r.phone.trim() || !r.address.trim());
    if (invalid) {
      toast("新增行需填写：户主姓名、联系电话、住址", "error");
      return;
    }
    if (newRows.length === 0) return;
    setPendingNewRows(newRows);
    setNewRowModalOpen(true);
  };

  const confirmCreateNewRows = async () => {
    setNewRowSaving(true);
    let ok = 0;
    let fail = 0;
    for (const r of pendingNewRows) {
      try {
        await apiFetch("/api/households", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            householdName: r.householdName?.trim() || undefined,
            headName: r.headName.trim(),
            phone: r.phone.trim(),
            groupName: r.groupName,
            address: r.address.trim(),
            memberCount: Number(r.memberCount) || 1,
            tags: Array.isArray(r.tags) ? r.tags : [],
            latitude: Number(r.latitude) || 0,
            longitude: Number(r.longitude) || 0,
          }),
        });
        ok++;
      } catch {
        fail++;
      }
    }
    setNewRowSaving(false);
    setNewRowModalOpen(false);
    if (ok > 0) toast(`成功新增 ${ok} 户`, "success");
    if (fail > 0) toast(`${fail} 户新增失败，请检查填写内容后重试`, "error");
    // 重新拉取真实数据
    const data = await apiFetch("/api/households").catch(() => null);
    if (Array.isArray(data)) setRows(data);
  };

  // ── 位置标记 ─────────────────────────────────────────────
  const openPicker = (row: SheetRow) => {
    const lng = Number(row.longitude);
    const lat = Number(row.latitude);
    setPickPos(!isNaN(lng) && !isNaN(lat) && (lng !== 0 || lat !== 0) ? { lng, lat } : null);
    setPickingRow(row);
  };

  const savePosition = async () => {
    if (!pickingRow || !pickPos) return;
    if (pickingRow.isNew) {
      setRows((prev) =>
        prev.map((r) =>
          r.id === pickingRow.id
            ? { ...r, latitude: String(pickPos.lat), longitude: String(pickPos.lng) }
            : r
        )
      );
      setPickingRow(null);
      setPickPos(null);
      toast("位置已暂存，保存新增住户时生效", "success");
      return;
    }
    setSavingPosition(true);
    try {
      const saved = await apiFetch(`/api/households/${pickingRow.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: String(pickPos.lat),
          longitude: String(pickPos.lng),
        }),
      });
      setRows((prev) => prev.map((r) => (r.id === pickingRow.id ? saved : r)));
      setPickingRow(null);
      setPickPos(null);
      toast("位置已更新", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "保存失败", "error");
    } finally {
      setSavingPosition(false);
    }
  };

  // ── 删除住户 ─────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/households/${deleteTarget.id}`, { method: "DELETE" });
      setRows((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      setSelectedRowId(null);
      setDeleteTarget(null);
      toast("住户已删除", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "删除失败", "error");
    } finally {
      setDeleting(false);
    }
  };

  const removeNewRow = (id: number) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  // 单元格是否在框选范围内
  const inRange = (r: number, c: number) =>
    rangeSel && r >= rangeSel.r1 && r <= rangeSel.r2 && c >= rangeSel.c1 && c <= rangeSel.c2;

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#8a95a8" }}>加载中...</div>
    );
  }

  const selectedRow = selectedRowId === null ? null : rows.find((r) => r.id === selectedRowId) ?? null;

  return (
    <div className="sheet-page">
      <div className="sheet-header">
        <div>
          <h1 className="sheet-title">
            <Table2 size={20} />
            表格编辑
          </h1>
          <p className="sheet-subtitle">
            共 {rows.filter((r) => !r.isNew).length} 户
            {newRows.length > 0 && <span style={{ color: "#e67e22" }}> · {newRows.length} 条待新增</span>}
            {" · "}单击单元格编辑 · 按住拖拽框选后可批量填充 · 点击行号选中整行
          </p>
        </div>
        <div className="sheet-toolbar">
          {savingCount > 0 && (
            <span className="sheet-saving-hint">
              <Loader2 size={13} className="sheet-spin" /> 保存中...
            </span>
          )}
          <button type="button" className="sheet-add-btn" onClick={addBlankRow}>
            <Plus size={14} />
            添加空行
          </button>
          {newRows.length > 0 && (
            <button type="button" className="sheet-save-new-btn" onClick={openNewRowModal}>
              <Save size={14} />
              保存新增住户（{newRows.length}）
            </button>
          )}
          {selectedRow && (
            <button type="button" className="sheet-delete-btn" onClick={() => setDeleteTarget(selectedRow)}>
              <Trash2 size={14} />
              删除选中住户
            </button>
          )}
          <div className="sheet-search">
            <Search size={16} color="#8a95a8" />
            <input
              type="text"
              placeholder="搜索户名、户主、电话、住址..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* 框选后的批量填充工具条 */}
      {rangeSel && (
        <div className="sheet-batch-bar">
          <span className="sheet-batch-info">
            已框选 {rangeSel.r2 - rangeSel.r1 + 1} 行 × {rangeSel.c2 - rangeSel.c1 + 1} 列（新增行不参与填充）
          </span>
          <PaintBucket size={14} color="#2f80ed" />
          <input
            ref={batchInputRef}
            className="sheet-batch-input"
            placeholder="输入填充值，按 Enter 应用到所有选中单元格"
            value={batchValue}
            onChange={(e) => setBatchValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyBatch();
            }}
          />
          <button type="button" className="sheet-batch-apply" onClick={applyBatch}>
            填充
          </button>
          <button
            type="button"
            className="sheet-batch-cancel"
            onClick={() => {
              setRangeSel(null);
              setBatchValue("");
            }}
          >
            取消（Esc）
          </button>
        </div>
      )}

      <div className="sheet-wrapper">
        <table className="sheet-table">
          <thead>
            <tr>
              <th className="sheet-th sheet-th-rownum">行号</th>
              {FIELDS.map((col) => (
                <th key={col.field} className="sheet-th" style={{ minWidth: col.width }}>
                  {col.label}
                </th>
              ))}
              <th className="sheet-th" style={{ minWidth: 200 }}>标签</th>
              <th className="sheet-th" style={{ minWidth: 170 }}>位置</th>
              <th className="sheet-th" style={{ minWidth: 90 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, r) => {
              const selected = selectedRowId === row.id;
              return (
                <tr key={row.id} className={`sheet-tr ${selected ? "selected" : ""}`}>
                  <td
                    className={`sheet-td sheet-td-rownum ${selected ? "selected" : ""}`}
                    onClick={() => setSelectedRowId((p) => (p === row.id ? null : row.id))}
                    title={selected ? "点击取消选中" : "点击选中整行，可删除该住户"}
                  >
                    {r + 1}
                  </td>
                  {FIELDS.map((col, c) => {
                    const isEditing = editing?.rowId === row.id && editing.field === col.field;
                    const inSel = inRange(r, c);
                    return (
                      <td key={col.field} className={`sheet-td ${inSel ? "in-range" : ""}`}>
                        {isEditing ? (
                          <input
                            ref={inputRef}
                            className="sheet-editor"
                            type={col.numeric ? "number" : "text"}
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === "Tab") {
                                e.preventDefault();
                                commitEdit();
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                setEditing(null);
                              }
                            }}
                          />
                        ) : (
                          <div
                            className="sheet-cell"
                            data-r={r}
                            data-c={c}
                            onMouseDown={(e) => cellMouseDown(r, c, e)}
                          >
                            {row[col.field] === "" || row[col.field] == null ? (
                              <span className="sheet-placeholder">—</span>
                            ) : (
                              String(row[col.field]) + (col.numeric ? " 人" : "")
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                  <td className="sheet-td">
                    <div
                      className="sheet-cell sheet-tags"
                      onClick={() => setTagRowId((p) => (p === row.id ? null : row.id))}
                    >
                      {(Array.isArray(row.tags) ? row.tags : []).length === 0 ? (
                        <span className="sheet-placeholder">点击设置</span>
                      ) : (
                        (Array.isArray(row.tags) ? row.tags : []).map((t) => (
                          <span
                            key={t}
                            className="sheet-tag"
                            style={{ background: `${getTagColor(t)}18`, color: getTagColor(t) }}
                          >
                            {t}
                          </span>
                        ))
                      )}
                    </div>
                    {tagRowId === row.id && (
                      <>
                        <div className="sheet-backdrop" onClick={() => setTagRowId(null)} />
                        <div className="sheet-tag-popover">
                          <p className="sheet-tag-popover-title">点击切换标签</p>
                          <div className="sheet-tag-popover-list">
                            {allTags.map((t) => {
                              const active = (row.tags ?? []).includes(t);
                              return (
                                <button
                                  key={t}
                                  type="button"
                                  className={`sheet-tag-option ${active ? "active" : ""}`}
                                  style={
                                    active
                                      ? { borderColor: getTagColor(t), color: getTagColor(t) }
                                      : undefined
                                  }
                                  onClick={() => toggleTag(row, t)}
                                >
                                  {t}
                                </button>
                              );
                            })}
                          </div>
                          <button type="button" className="sheet-tag-done" onClick={() => setTagRowId(null)}>
                            完成
                          </button>
                        </div>
                      </>
                    )}
                  </td>
                  <td className="sheet-td">
                    <div className="sheet-cell sheet-position" onClick={() => openPicker(row)}>
                      <MapPin size={13} color={hasPosition(row) ? "#27ae60" : "#b0b8c8"} />
                      {hasPosition(row) ? (
                        <span>{row.markedAddress || row.address || "已标记"}</span>
                      ) : (
                        <span className="sheet-placeholder">点击标记</span>
                      )}
                    </div>
                  </td>
                  <td className="sheet-td">
                    <div className="sheet-cell sheet-actions">
                      {row.isNew ? (
                        <button type="button" className="sheet-remove-new" onClick={() => removeNewRow(row.id)}>
                          移除
                        </button>
                      ) : (
                        <>
                          <Link href={`/household/${row.id}`} className="sheet-link" title="查看详情">
                            详情 <ExternalLink size={11} />
                          </Link>
                          <button
                            type="button"
                            className="sheet-row-delete"
                            title="删除该住户"
                            onClick={() => setDeleteTarget(row)}
                          >
                            删除
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={FIELDS.length + 4} className="sheet-empty">
                  没有匹配的住户
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 删除确认弹窗 */}
      <Modal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="确认删除"
        subtitle="此操作不可撤销"
      >
        <div style={{ padding: "0 24px 24px" }}>
          <p style={{ fontSize: 14, color: "#5a6577", lineHeight: 1.6, marginBottom: 20 }}>
            确定要删除住户{" "}
            <b style={{ color: "#eb5757" }}>
              {deleteTarget?.householdName || deleteTarget?.headName}
            </b>{" "}
            吗？关联的走访记录和家庭成员将一并删除。
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
              style={{
                padding: "8px 20px", borderRadius: 8, border: "1px solid #e4e8ef",
                background: "#fff", color: "#5a6577", fontSize: 14, cursor: "pointer",
              }}
            >
              取消
            </button>
            <button
              onClick={confirmDelete}
              disabled={deleting}
              style={{
                padding: "8px 20px", borderRadius: 8, border: "none",
                background: "#eb5757", color: "#fff", fontSize: 14, fontWeight: 600,
                cursor: "pointer", opacity: deleting ? 0.7 : 1,
              }}
            >
              {deleting ? "删除中..." : "确认删除"}
            </button>
          </div>
        </div>
      </Modal>

      {/* 新增住户确认弹窗 */}
      <Modal
        isOpen={newRowModalOpen}
        onClose={() => setNewRowModalOpen(false)}
        title="确认新增住户"
        subtitle={`${pendingNewRows.length} 条新记录将写入数据库`}
      >
        <div style={{ padding: "0 24px 24px", maxHeight: 300, overflowY: "auto" }}>
          {pendingNewRows.map((r, i) => (
            <div key={r.id} className="new-row-summary">
              <span>
                {i + 1}. {r.headName}
              </span>
              {!hasPosition(r) && (
                <span className="new-row-warn">未标记位置（保存后可在「位置」列标记）</span>
              )}
            </div>
          ))}
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 20 }}>
            <button
              onClick={() => setNewRowModalOpen(false)}
              disabled={newRowSaving}
              style={{
                padding: "8px 20px", borderRadius: 8, border: "1px solid #e4e8ef",
                background: "#fff", color: "#5a6577", fontSize: 14, cursor: "pointer",
              }}
            >
              取消
            </button>
            <button
              onClick={confirmCreateNewRows}
              disabled={newRowSaving}
              style={{
                padding: "8px 20px", borderRadius: 8, border: "none",
                background: "#27ae60", color: "#fff", fontSize: 14, fontWeight: 600,
                cursor: "pointer", opacity: newRowSaving ? 0.7 : 1,
              }}
            >
              {newRowSaving ? "保存中..." : "确认新增"}
            </button>
          </div>
        </div>
      </Modal>

      {/* 位置标记弹窗：地图选点 */}
      {pickingRow && (
        <div className="modal-layer" onClick={() => !savingPosition && setPickingRow(null)}>
          <div className="sheet-picker-modal" onClick={(e) => e.stopPropagation()}>
            <header>
              <h2>标记位置 - {pickingRow.headName || "新住户"}</h2>
              <span className="sheet-picker-hint">
                {pickPos ? "在地图上点击调整位置" : "在地图上点击住户位置"}
              </span>
              <button className="close-button" aria-label="关闭" onClick={() => setPickingRow(null)}>
                ✕
              </button>
            </header>
            <div className="sheet-picker-body">
              <MapContainer
                households={pickPos ? [] : [pickingRow]}
                selectedId={null}
                onSelect={() => {}}
                onMapClick={(lng: number, lat: number) => setPickPos({ lng, lat })}
                pickingMode={true}
                pickPosition={pickPos}
                defaultMapType="satellite"
              />
            </div>
            <footer>
              <span className="sheet-picker-coord">
                {pickPos
                  ? `经度 ${pickPos.lng.toFixed(6)} · 纬度 ${pickPos.lat.toFixed(6)}`
                  : "尚未选点"}
              </span>
              <div style={{ display: "flex", gap: 12 }}>
                <button
                  type="button"
                  className="sheet-picker-cancel"
                  onClick={() => setPickingRow(null)}
                  disabled={savingPosition}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="sheet-picker-save"
                  onClick={savePosition}
                  disabled={!pickPos || savingPosition}
                >
                  {savingPosition ? "保存中..." : "保存位置"}
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}

      <style>{`
        .sheet-page { padding: 20px 24px; }
        .sheet-header {
          display: flex; align-items: center; justify-content: space-between;
          gap: 16px; margin-bottom: 12px; flex-wrap: wrap;
        }
        .sheet-title {
          display: flex; align-items: center; gap: 8px;
          font-size: 22px; font-weight: 800; color: #2b405b; margin: 0;
        }
        .sheet-subtitle { font-size: 12px; color: #8a95a8; margin: 4px 0 0; }
        .sheet-toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .sheet-saving-hint {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 12px; color: #2f80ed; font-weight: 600;
        }
        .sheet-spin { animation: sheet-spin 1s linear infinite; }
        @keyframes sheet-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .sheet-add-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 14px; border-radius: 10px; border: 1px solid #2f80ed;
          background: #fff; color: #2f80ed; font-size: 13px; font-weight: 600;
          cursor: pointer;
        }
        .sheet-add-btn:hover { background: #f0f6ff; }
        .sheet-save-new-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 14px; border-radius: 10px; border: none;
          background: #27ae60; color: #fff; font-size: 13px; font-weight: 600;
          cursor: pointer;
        }
        .sheet-save-new-btn:hover { background: #219653; }
        .sheet-delete-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 14px; border-radius: 10px; border: 1px solid #f0c0c0;
          background: #fdf1f1; color: #eb5757; font-size: 13px; font-weight: 600;
          cursor: pointer;
        }
        .sheet-delete-btn:hover { background: #fbdede; }
        .sheet-search { position: relative; display: flex; align-items: center; }
        .sheet-search svg { position: absolute; left: 12px; }
        .sheet-search input {
          width: 260px; padding: 9px 12px 9px 34px; border-radius: 10px;
          border: 1px solid #e4e8ef; font-size: 13px; outline: none;
          background: #fff; color: #2b405b; box-sizing: border-box;
        }
        .sheet-search input:focus { border-color: #2f80ed; }

        /* 批量填充工具条 */
        .sheet-batch-bar {
          display: flex; align-items: center; gap: 8px;
          padding: 8px 12px; margin-bottom: 12px; border-radius: 10px;
          background: #eaf2ff; border: 1px solid #bcd8f5;
        }
        .sheet-batch-info { font-size: 12px; color: #2b405b; font-weight: 600; }
        .sheet-batch-input {
          flex: 1; padding: 7px 10px; border-radius: 8px;
          border: 1px solid #bcd8f5; font-size: 13px; outline: none;
          background: #fff; color: #2b405b;
        }
        .sheet-batch-input:focus { border-color: #2f80ed; }
        .sheet-batch-apply {
          padding: 7px 16px; border-radius: 8px; border: none;
          background: #2f80ed; color: #fff; font-size: 13px; font-weight: 600;
          cursor: pointer;
        }
        .sheet-batch-apply:hover { background: #2567c0; }
        .sheet-batch-cancel {
          padding: 7px 12px; border-radius: 8px; border: 1px solid #bcd8f5;
          background: #fff; color: #5a6577; font-size: 12px; cursor: pointer;
        }

        /* 表格：完整网格线 */
        .sheet-wrapper {
          overflow: auto; border: 1px solid #c9d2e0; border-radius: 12px;
          background: #fff; max-height: calc(100vh - 210px);
        }
        .sheet-table {
          border-collapse: collapse; width: 100%;
          min-width: 1200px; table-layout: fixed;
          font-size: 13px; color: #2b405b;
        }
        .sheet-th {
          position: sticky; top: 0; z-index: 3;
          background: #f5f7fa; color: #5a6577; font-weight: 700; font-size: 12px;
          text-align: left; padding: 10px 12px; white-space: nowrap;
          border: 1px solid #c9d2e0;
        }
        .sheet-th-rownum {
          position: sticky; left: 0; z-index: 4; width: 56px; text-align: center;
        }
        .sheet-td {
          border: 1px solid #c9d2e0; padding: 0; position: relative; height: 38px;
          background: #fff;
        }
        .sheet-td-rownum {
          position: sticky; left: 0; z-index: 2;
          text-align: center; color: #5a6577; font-size: 12px; font-weight: 600;
          cursor: pointer; user-select: none;
        }
        .sheet-td-rownum:hover { background: #edf3ff; color: #2f80ed; }
        .sheet-td-rownum.selected { background: #2f80ed; color: #fff; font-weight: 700; }
        .sheet-tr.selected .sheet-td { background: #eaf2ff; }
        .sheet-tr:hover .sheet-td:not(.sheet-td-rownum) { background: #f7faff; }
        .sheet-cell {
          display: flex; align-items: center;
          min-height: 38px; padding: 0 12px; cursor: cell;
          overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
          user-select: none;
        }
        .sheet-cell:hover { background: #eef4ff; }
        .sheet-td.in-range { background: #dbeafe; }
        .sheet-td.in-range .sheet-cell:hover { background: #c8e0fd; }
        .sheet-placeholder { color: #c0c8d4; }

        /* 编辑态：蓝色边框，无光晕 */
        .sheet-editor {
          width: 100%; height: 38px; padding: 0 10px;
          border: 2px solid #2f80ed; border-radius: 0;
          font-size: 13px; font-family: inherit; color: #2b405b;
          background: #fff; box-sizing: border-box; outline: none;
          box-shadow: none; appearance: none;
        }

        /* 标签 */
        .sheet-tags { flex-wrap: nowrap; gap: 4px; cursor: pointer; }
        .sheet-tag {
          padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; flex-shrink: 0;
        }
        .sheet-backdrop { position: fixed; inset: 0; z-index: 40; }
        .sheet-tag-popover {
          position: absolute; top: 40px; left: 0; z-index: 41;
          background: #fff; border: 1px solid #e4e8ef; border-radius: 10px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.15); padding: 12px; width: 250px;
        }
        .sheet-tag-popover-title { margin: 0 0 8px; font-size: 11px; color: #8a95a8; }
        .sheet-tag-popover-list { display: flex; flex-wrap: wrap; gap: 6px; }
        .sheet-tag-option {
          padding: 4px 10px; border-radius: 7px; border: 1px solid #e4e8ef;
          background: #fff; color: #5a6577; font-size: 12px; font-weight: 600;
          cursor: pointer;
        }
        .sheet-tag-option:hover { border-color: #2f80ed; color: #2f80ed; }
        .sheet-tag-option.active { background: #f5f8ff; }
        .sheet-tag-done {
          margin-top: 8px; width: 100%; padding: 5px 0; border-radius: 7px; border: none;
          background: #2f80ed; color: #fff; font-size: 12px; font-weight: 600; cursor: pointer;
        }
        .sheet-tag-done:hover { background: #2567c0; }

        /* 位置 / 操作列 */
        .sheet-position { gap: 5px; cursor: pointer; }
        .sheet-position svg { flex-shrink: 0; }
        .sheet-position:hover { color: #2f80ed; }
        .sheet-actions { gap: 8px; cursor: default; }
        .sheet-actions:hover { background: #fff; }
        .sheet-link {
          display: inline-flex; align-items: center; gap: 3px;
          color: #2f80ed; font-size: 12px; font-weight: 600; text-decoration: none;
        }
        .sheet-link:hover { text-decoration: underline; }
        .sheet-row-delete {
          border: none; background: none; color: #eb5757; font-size: 12px;
          font-weight: 600; cursor: pointer; padding: 2px 4px;
        }
        .sheet-row-delete:hover { text-decoration: underline; }
        .sheet-remove-new {
          border: 1px solid #e4e8ef; background: #fff; color: #8a95a8;
          font-size: 12px; font-weight: 600; cursor: pointer;
          padding: 3px 10px; border-radius: 6px;
        }
        .sheet-remove-new:hover { border-color: #eb5757; color: #eb5757; }

        .new-row-summary {
          display: flex; align-items: center; justify-content: space-between;
          padding: 8px 0; border-bottom: 1px solid #f0f2f5; font-size: 13px; color: #2b405b;
        }
        .new-row-warn { color: #e67e22; font-size: 12px; font-weight: 600; }
        .sheet-empty { text-align: center; color: #8a95a8; padding: 40px; }

        /* 位置标记弹窗 */
        .sheet-picker-modal {
          background: #fff; border-radius: 14px; width: min(760px, 92vw);
          max-height: 88vh; display: flex; flex-direction: column;
          box-shadow: 0 20px 60px rgba(0,0,0,0.25); overflow: hidden;
        }
        .sheet-picker-modal header {
          display: flex; align-items: center; gap: 12px;
          padding: 14px 20px; border-bottom: 1px solid #eef1f5;
        }
        .sheet-picker-modal h2 { margin: 0; font-size: 16px; font-weight: 800; color: #2b405b; flex: 1; }
        .sheet-picker-hint { font-size: 12px; color: #8a95a8; }
        .sheet-picker-modal .close-button {
          border: none; background: none; cursor: pointer; font-size: 16px;
          color: #8a95a8; padding: 4px 8px; border-radius: 6px;
        }
        .sheet-picker-modal .close-button:hover { background: #f0f2f5; color: #2b405b; }
        .sheet-picker-body { height: 480px; position: relative; }
        .sheet-picker-body > div { position: absolute; inset: 0; }
        .sheet-picker-modal footer {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 20px; border-top: 1px solid #eef1f5;
        }
        .sheet-picker-coord { font-size: 12px; color: #5a6577; }
        .sheet-picker-cancel {
          padding: 8px 18px; border-radius: 8px; border: 1px solid #e4e8ef;
          background: #fff; color: #5a6577; font-size: 13px; cursor: pointer;
        }
        .sheet-picker-save {
          padding: 8px 18px; border-radius: 8px; border: none;
          background: #27ae60; color: #fff; font-size: 13px; font-weight: 600;
          cursor: pointer;
        }
        .sheet-picker-save:disabled { background: #a8d8b6; cursor: not-allowed; }

        @media (max-width: 768px) {
          .sheet-search input { width: 100%; }
          .sheet-search { width: 100%; }
        }
      `}</style>
    </div>
  );
}
