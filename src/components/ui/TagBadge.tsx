"use client";

import { getTagColor } from "@/lib/tags";

export function TagBadge({ tag }: { tag: string }) {
  return (
    <span
      className="tag-badge"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 600,
        color: getTagColor(tag),
        background: `${getTagColor(tag)}15`,
        border: `1px solid ${getTagColor(tag)}30`,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: getTagColor(tag),
        }}
      />
      {tag}
    </span>
  );
}
