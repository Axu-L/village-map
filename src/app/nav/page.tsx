"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { NavMap } from "@/components/nav/NavMap";
import { NavSheet } from "@/components/nav/NavSheet";
import { VisitForm } from "@/components/visit/VisitForm";
import type { Household, NavRouteParams, NavRouteInfo } from "@/types";

const STORAGE_KEY = "villagemap-nav-plan";

interface NavPlanPayload {
  params: NavRouteParams;
  households: Household[];
  visitMode?: boolean;
  voiceEnabled?: boolean;
}

function NavPageContent() {
  const router = useRouter();
  const [plan, setPlan] = useState<NavPlanPayload | null>(null);
  const [routeInfo, setRouteInfo] = useState<NavRouteInfo | null>(null);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [visitHousehold, setVisitHousehold] = useState<Household | null>(null);

  // 从 sessionStorage 读取地图页传递的导航计划
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) {
        router.replace("/map");
        return;
      }
      const parsed = JSON.parse(raw) as NavPlanPayload;
      setPlan(parsed);
      setVoiceEnabled(parsed.voiceEnabled ?? true);
    } catch {
      router.replace("/map");
    }
  }, [router]);

  // 路线规划完成 → 回填抽屉信息
  const handleRouteInfo = (info: {
    distance: string;
    time: string;
    steps: string[];
  }) => {
    if (!plan) return;
    setRouteInfo({
      distance: info.distance,
      time: info.time,
      steps: info.steps,
      households: plan.households,
    });
    if (info.steps.length > 0) setCurrentStepIdx(0);
  };

  // 走访模式：到达住户附近自动弹出走访表单
  const handleArriveHousehold = (h: Household) => {
    setVisitHousehold(h);
  };

  // 语音播报当前步骤
  const handleStepClick = (idx: number) => {
    setCurrentStepIdx(idx);
    const step = routeInfo?.steps[idx];
    if (voiceEnabled && step && typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(step);
      utter.lang = "zh-CN";
      utter.rate = 1.1;
      window.speechSynthesis.speak(utter);
    }
  };

  const handleToggleVoice = () => {
    setVoiceEnabled((v) => {
      const next = !v;
      if (!next && typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      return next;
    });
  };

  if (!plan) {
    return (
      <div className="nav-page">
        <div className="nav-loading">准备导航...</div>
      </div>
    );
  }

  return (
    <div className="nav-page">
      <div className="nav-map-area">
        <NavMap
          params={plan.params}
          households={plan.households}
          visitMode={plan.visitMode}
          onRouteInfo={handleRouteInfo}
          onArriveHousehold={handleArriveHousehold}
        />
      </div>

      <NavSheet
        info={routeInfo}
        mode={plan.params.mode}
        visitMode={!!plan.visitMode}
        currentStepIdx={currentStepIdx}
        voiceEnabled={voiceEnabled}
        onStepClick={handleStepClick}
        onToggleVoice={handleToggleVoice}
        onClose={() => {
          sessionStorage.removeItem(STORAGE_KEY);
        }}
      />

      {visitHousehold && (
        <VisitForm
          householdId={visitHousehold.id}
          householdName={visitHousehold.householdName}
          onSave={() => {}}
          onClose={() => setVisitHousehold(null)}
        />
      )}
    </div>
  );
}

export default function NavPage() {
  return (
    <Suspense
      fallback={
        <div className="nav-page">
          <div className="nav-loading">加载中...</div>
        </div>
      }
    >
      <NavPageContent />
    </Suspense>
  );
}
