"use client";

import type { Household } from "@/types";
import { TagBadge } from "@/components/ui/TagBadge";
import { maskPhone } from "@/lib/utils";
import {
  X,
  Navigation,
  PlusCircle,
  FileText,
  ExternalLink,
  Home,
} from "lucide-react";
import Link from "next/link";

interface HouseholdDrawerProps {
  household: Household;
  onClose: () => void;
  onNavigate: () => void;
  onAddVisit: () => void;
}

export function HouseholdDrawer({
  household,
  onClose,
  onNavigate,
  onAddVisit,
}: HouseholdDrawerProps) {
  return (
    <div className="drawer open">
      <div className="drawer-header">
        <div>
          <h3 className="drawer-title">{household.householdName}</h3>
          <span className="drawer-group">
            <Home size={13} />
            {household.groupName}
          </span>
        </div>
        <button className="close-button" onClick={onClose}>
          <X size={20} />
        </button>
      </div>

      <div className="drawer-body">
        <div className="drawer-row">
          <span className="drawer-label">户主</span>
          <span className="drawer-value">{household.headName}</span>
        </div>
        <div className="drawer-row">
          <span className="drawer-label">联系电话</span>
          <span className="drawer-value">{maskPhone(household.phone)}</span>
        </div>
        <div className="drawer-row">
          <span className="drawer-label">家庭人数</span>
          <span className="drawer-value">{household.memberCount} 人</span>
        </div>

        <div className="drawer-section">
          <span className="drawer-label">特殊群体</span>
          <div className="drawer-tags">
            {household.tags.map((tag) => (
              <TagBadge key={tag} tag={tag} />
            ))}
          </div>
        </div>

        <div className="drawer-section">
          <span className="drawer-label">最近走访</span>
          <span className="drawer-value">
            {household.lastVisitAt
              ? new Date(household.lastVisitAt).toLocaleDateString("zh-CN")
              : "暂无走访"}
          </span>
        </div>
      </div>

      <div className="drawer-actions">
        <Link href={`/household/${household.id}`} className="drawer-btn primary">
          <ExternalLink size={15} />
          查看详情
        </Link>
        <button className="drawer-btn" onClick={onAddVisit}>
          <PlusCircle size={15} />
          新增走访
        </button>
        <button className="drawer-btn" onClick={onNavigate}>
          <Navigation size={15} />
          导航
        </button>
        <Link href={`/household/${household.id}?edit=1`} className="drawer-btn">
          <FileText size={15} />
          编辑
        </Link>
      </div>
    </div>
  );
}
