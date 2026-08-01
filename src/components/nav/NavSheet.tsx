"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { NavRouteInfo } from "@/types";
import { ChevronUp, ChevronDown, X, Volume2, VolumeX, Navigation } from "lucide-react";

// 三段式抽屉档位：peek（仅摘要）/ half（半屏）/ full（全屏）
type Stage = "peek" | "half" | "full";
const STAGE_ORDER: Stage[] = ["peek", "half", "full"];

interface NavSheetProps {
  info: NavRouteInfo | null;
  mode: "driving" | "walking" | "riding";
  visitMode: boolean;
  currentStepIdx: number;
  voiceEnabled: boolean;
  onStepClick: (idx: number) => void;
  onToggleVoice: () => void;
  onClose: () => void;
}

export function NavSheet({
  info,
  mode,
  visitMode,
  currentStepIdx,
  voiceEnabled,
  onStepClick,
  onToggleVoice,
  onClose,
}: NavSheetProps) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("half");
  const contentRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({
    startY: 0,
    startStage: stage,
    dragging: false,
    moved: false,
  });

  const nextStage = useCallback(() => {
    setStage((s) => {
      const i = STAGE_ORDER.indexOf(s);
      return i < STAGE_ORDER.length - 1 ? STAGE_ORDER[i + 1] : s;
    });
  }, []);

  const prevStage = useCallback(() => {
    setStage((s) => {
      const i = STAGE_ORDER.indexOf(s);
      return i > 0 ? STAGE_ORDER[i - 1] : s;
    });
  }, []);

  // 档位变化时通知 NavMap 重算路线视野，使路线落在未被遮挡的可见区居中
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("nav-sheet-stage-change", { detail: { stage } })
    );
  }, [stage]);

  // 嵌套滚动手势仲裁：
  // - 在内容区向下拖动时，若已滚动到顶部（scrollTop===0），则把拖动让给抽屉收起
  // - 在内容区向上拖动时，若已滚动到底部，则把拖动让给抽屉展开
  const onTouchStart = (e: React.TouchEvent) => {
    dragState.current = {
      startY: e.touches[0].clientY,
      startStage: stage,
      dragging: true,
      moved: false,
    };
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragState.current.dragging) return;
    const dy = e.touches[0].clientY - dragState.current.startY;
    if (Math.abs(dy) > 8) dragState.current.moved = true;

    const el = contentRef.current;
    const atTop = !el || el.scrollTop <= 0;
    // 向下拖且内容已在顶部 → 阻止内容滚动，让抽屉响应（收起）
    if (dy > 0 && atTop) {
      e.preventDefault();
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!dragState.current.dragging) return;
    const dy = (e.changedTouches[0]?.clientY ?? dragState.current.startY) - dragState.current.startY;
    dragState.current.dragging = false;

    if (!dragState.current.moved) return;
    const threshold = 30;
    if (dy < -threshold) {
      nextStage(); // 上拖 → 展开
    } else if (dy > threshold) {
      prevStage(); // 下拖 → 收起
    }
  };

  const distance = info?.distance ?? "—";
  const time = info?.time ?? "—";
  const count = info?.households.length ?? 0;
  const steps = info?.steps ?? [];

  const modeLabel = mode === "driving" ? "驾车" : mode === "walking" ? "步行" : "骑行";

  return (
    <div className={`nav-sheet stage-${stage}`} data-stage={stage}>
      {/* 拖拽把手 + 摘要（peek 始终可见） */}
      <div
        className="nav-sheet-header"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="nav-sheet-grabber" />
        <div className="nav-sheet-summary">
          <div className="nav-sheet-stats">
            <div className="nav-sheet-stat">
              <strong>{distance}</strong>
              <span>总距离</span>
            </div>
            <div className="nav-sheet-stat">
              <strong>{time}</strong>
              <span>预计时间</span>
            </div>
            <div className="nav-sheet-stat">
              <strong>{count} 户</strong>
              <span>走访户数</span>
            </div>
            <div className="nav-sheet-stat">
              <strong>{modeLabel}</strong>
              <span>出行方式</span>
            </div>
          </div>
          <div className="nav-sheet-actions">
            <button
              className="nav-sheet-icon-btn"
              aria-label={voiceEnabled ? "关闭语音" : "开启语音"}
              onClick={onToggleVoice}
            >
              {voiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <button
              className="nav-sheet-icon-btn"
              aria-label={stage === "full" ? "收起" : "展开"}
              onClick={() => (stage === "full" ? prevStage() : nextStage())}
            >
              {stage === "full" ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
            </button>
            <button
              className="nav-sheet-icon-btn close"
              aria-label="退出导航"
              onClick={() => {
                if (typeof window !== "undefined" && window.speechSynthesis) {
                  window.speechSynthesis.cancel();
                }
                onClose();
                router.push("/map");
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>
        {visitMode && (
          <div className="nav-sheet-visit-tip">
            <Navigation size={13} />
            走访模式已开启，到达住户附近将自动弹窗
          </div>
        )}
      </div>

      {/* 可滚动内容（half / full 可见） */}
      <div
        className="nav-sheet-content"
        ref={contentRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {steps.length > 0 && (
          <section className="nav-sheet-section">
            <h4>导航步骤（{steps.length}）</h4>
            <div className="nav-steps-list">
              {steps.map((step, idx) => {
                const done = idx < currentStepIdx;
                const active = idx === currentStepIdx;
                return (
                  <div
                    key={idx}
                    className={`nav-step-item ${done ? "done" : ""} ${active ? "active" : ""}`}
                    onClick={() => onStepClick(idx)}
                  >
                    <div className="nav-step-track">
                      <span className="nav-step-dot" />
                      {idx < steps.length - 1 && <span className="nav-step-line" />}
                    </div>
                    <span className="nav-step-text">{step}</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {info && info.households.length > 0 && (
          <section className="nav-sheet-section">
            <h4>走访住户（{info.households.length}）</h4>
            <div className="nav-household-list">
              {info.households.map((h, idx) => (
                <div key={h.id} className="nav-household-item">
                  <span className="nav-household-no">{idx + 1}</span>
                  <div className="nav-household-info">
                    <span className="nav-household-name">{h.householdName}</span>
                    <span className="nav-household-sub">
                      {h.groupName} · 户主 {h.headName}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
