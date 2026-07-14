"use client";

import { allTags, getTagColor } from "@/lib/tags";
import { Plus, Navigation } from "lucide-react";
import type { Tag } from "@/types";

interface MapToolbarProps {
  filterTags: Tag[];
  onFilterChange: (tags: Tag[]) => void;
  resultCount: number;
  totalCount: number;
  onAddClick: () => void;
  onRouteClick?: () => void;
}

export function MapToolbar({
  filterTags,
  onFilterChange,
  resultCount,
  totalCount,
  onAddClick,
  onRouteClick,
}: MapToolbarProps) {
  const toggleTag = (tag: Tag) => {
    if (filterTags.includes(tag)) {
      onFilterChange(filterTags.filter((t) => t !== tag));
    } else {
      onFilterChange([...filterTags, tag]);
    }
  };

  return (
    <div className="map-toolbar">
      <div className="toolbar-tags">
        {allTags.map((tag) => (
          <button
            key={tag}
            className={`tag-filter-btn ${filterTags.includes(tag) ? "active" : ""}`}
            style={
              filterTags.includes(tag)
                ? {
                    background: getTagColor(tag),
                    color: "#fff",
                    borderColor: getTagColor(tag),
                  }
                : {
                    color: getTagColor(tag),
                    borderColor: `${getTagColor(tag)}40`,
                  }
            }
            onClick={() => toggleTag(tag)}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: filterTags.includes(tag) ? "#fff" : getTagColor(tag),
              }}
            />
            {tag}
          </button>
        ))}
      </div>

      <div className="toolbar-actions">
        <span className="result-count">
          已定位 {resultCount}/{totalCount} 户
        </span>
        {onRouteClick && (
          <button className="route-btn" onClick={onRouteClick}>
            <Navigation size={16} />
            <span>开始走访</span>
          </button>
        )}
        <button className="add-household-btn" onClick={onAddClick}>
          <Plus size={18} />
          <span>新增住户</span>
        </button>
      </div>
    </div>
  );
}
