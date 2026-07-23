"use client";

import { useState, useEffect } from "react";
import type { Household } from "@/types";
import type { RoutePlanParams } from "@/components/map/MapContainer";
import { initAMap, DEFAULT_CENTER } from "@/lib/amap";
import { X, Navigation, Car, Footprints, Bike, MapPin, Check, Volume2, VolumeX } from "lucide-react";

interface RoutePlanProps {
  households: Household[];
  onClose: () => void;
  onPlan: (params: RoutePlanParams, count: number, selectedHouseholds: Household[]) => void;
}

type TravelMode = "driving" | "walking" | "riding";

export function RoutePlan({ households, onClose, onPlan }: RoutePlanProps) {
  const [travelMode, setTravelMode] = useState<TravelMode>("driving");
  const [selectedIds, setSelectedIds] = useState<number[]>(
    households.map((h) => h.id)
  );
  const [currentPos, setCurrentPos] = useState<{
    lng: number;
    lat: number;
  } | null>(null);
  const [currentAddress, setCurrentAddress] = useState("定位中...");
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  // 使用 AMap 定位获取当前位置（与地图坐标系一致 GCJ02）
  useEffect(() => {
    let cancelled = false;

    initAMap(["AMap.Geocoder", "AMap.Geolocation"])
      .then((AMap: any) => {
        if (cancelled) return;

        // 用 AMap.Geolocation 获取当前定位（GCJ02坐标系，与地图一致）
        const geolocation = new AMap.Geolocation({
          enableHighAccuracy: true,
          timeout: 10000,
          GeoLocationFirst: true,
          showButton: false,
          showMarker: false,
          showCircle: false,
        });

        geolocation.getCurrentPosition((status: string, result: any) => {
          if (cancelled) return;
          if (status === "complete") {
            const lng = result.position.getLng();
            const lat = result.position.getLat();
            setCurrentPos({ lng, lat });
            // 逆地理编码
            const geocoder = new AMap.Geocoder();
            geocoder.getAddress([lng, lat], (geoStatus: string, geoResult: any) => {
              if (cancelled) return;
              if (geoStatus === "complete" && geoResult.info === "OK") {
                setCurrentAddress(geoResult.regeocode.formattedAddress);
              } else {
                setCurrentAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
              }
            });
          } else {
            // 定位失败，使用默认位置
            setCurrentPos({ lng: DEFAULT_CENTER[0], lat: DEFAULT_CENTER[1] });
            setCurrentAddress("花园村（默认位置）");
          }
        });
      })
      .catch(() => {
        if (cancelled) return;
        setCurrentPos({ lng: DEFAULT_CENTER[0], lat: DEFAULT_CENTER[1] });
        setCurrentAddress("花园村（默认位置）");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const toggleHousehold = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => setSelectedIds(households.map((h) => h.id));
  const deselectAll = () => setSelectedIds([]);

  const handlePlan = () => {
    if (!currentPos || selectedIds.length === 0) return;

    const selectedHouseholds = selectedIds
      .map((id) => households.find((h) => h.id === id))
      .filter((h): h is Household => !!h)
      .sort((a, b) => {
        const distA = Math.hypot(
          Number(a.longitude) - currentPos.lng,
          Number(a.latitude) - currentPos.lat
        );
        const distB = Math.hypot(
          Number(b.longitude) - currentPos.lng,
          Number(b.latitude) - currentPos.lat
        );
        return distA - distB;
      });

    if (selectedHouseholds.length === 0) return;

    const origin: [number, number] = [currentPos.lng, currentPos.lat];
    const lastHousehold = selectedHouseholds[selectedHouseholds.length - 1];
    const destination: [number, number] = [
      Number(lastHousehold.longitude),
      Number(lastHousehold.latitude),
    ];

    const waypoints: [number, number][] = selectedHouseholds
      .slice(0, -1)
      .map((h) => [Number(h.longitude), Number(h.latitude)] as [number, number]);

    const params: RoutePlanParams = {
      origin,
      destination,
      waypoints: waypoints.length > 0 ? waypoints : undefined,
      mode: travelMode,
      voiceEnabled,
      visitCount: selectedIds.length,
    };

    onPlan(params, selectedIds.length, selectedHouseholds);
  };

  const modeOptions: {
    key: TravelMode;
    label: string;
    icon: React.ReactNode;
  }[] = [
    { key: "driving", label: "驾车", icon: <Car size={14} /> },
    { key: "walking", label: "步行", icon: <Footprints size={14} /> },
    { key: "riding", label: "骑行", icon: <Bike size={14} /> },
  ];

  return (
    <div className="modal-layer" onClick={onClose}>
      <div
        className="route-plan-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <h2>开始走访</h2>
          <button className="close-button" aria-label="关闭" onClick={onClose}>
            <X size={20} />
          </button>
        </header>

        <div className="route-plan-body">
          <div className="route-section">
            <span className="route-label">出行方式</span>
            <div className="route-mode-switch">
              {modeOptions.map((opt) => (
                <button
                  key={opt.key}
                  className={`mode-btn ${travelMode === opt.key ? "active" : ""}`}
                  onClick={() => setTravelMode(opt.key)}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="route-section">
            <span className="route-label">起点</span>
            <div className="route-origin">
              <MapPin size={14} />
              <span className="route-origin-text">{currentAddress}</span>
            </div>
          </div>

          <div className="route-section">
            <div className="route-label-row">
              <span className="route-label">走访住户</span>
              <div className="route-select-actions">
                <button onClick={selectAll}>全选</button>
                <button onClick={deselectAll}>清空</button>
              </div>
            </div>
            <div className="route-household-list">
              {households.map((h) => (
                <label key={h.id} className="route-household-item">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(h.id)}
                    onChange={() => toggleHousehold(h.id)}
                  />
                  <span className="route-check">
                    {selectedIds.includes(h.id) && <Check size={10} />}
                  </span>
                  <span className="route-household-name">
                    {h.householdName}
                  </span>
                  <span className="route-household-group">{h.groupName}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="route-section">
            <span className="route-label">语音导航</span>
            <button
              className={`voice-toggle ${voiceEnabled ? "active" : ""}`}
              onClick={() => setVoiceEnabled(!voiceEnabled)}
            >
              {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              <span>{voiceEnabled ? "已开启" : "已关闭"}</span>
            </button>
          </div>

          <div className="route-actions">
            <button
              className="save-button"
              onClick={handlePlan}
              disabled={!currentPos || selectedIds.length === 0}
            >
              <Navigation size={16} />
              开始走访
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
