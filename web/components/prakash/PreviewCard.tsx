"use client";

import { X, Check } from "lucide-react";
import { COLORS } from "@/lib/theme";
import {
  CATEGORIES,
  CATEGORY_META,
  Category,
  PRIORITIES,
  PRIORITY_COLORS,
  Priority,
  TeamMember,
  teamColor,
} from "@/lib/prakash/constants";
import type { Reason } from "@/lib/prakash/parser";

export interface PreviewState {
  entryId: string;
  message: string;
  origCategory: Category;
  origPriority: Priority;
  categoryReason: Reason;
  priorityReason: Reason;
  learnedCategory: boolean;
  learnedPriority: boolean;
  title: string;
  assignee: string;
  category: Category;
  priority: Priority;
  dueLabel: string;
  notes: string | null;
  edited: boolean;
  submitting?: boolean;
  error?: string;
}

function reasonText(r: Reason): string {
  if (r.type === "learned") return "🧠 Learned from past correction";
  if (r.type === "keyword") return `📌 Keyword: "${r.detail}"`;
  return "— No keyword match (default)";
}

const inputStyle = { background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text };

export function PreviewCard({
  p,
  team,
  onChange,
  onConfirm,
  onDiscard,
}: {
  p: PreviewState;
  team: TeamMember[];
  onChange: (patch: Partial<PreviewState>) => void;
  onConfirm: () => void;
  onDiscard: () => void;
}) {
  const learnedApplied = p.learnedCategory || p.learnedPriority;
  return (
    <div
      className="rounded-lg p-3 mb-2"
      style={{ background: COLORS.surface, border: `1px solid ${COLORS.primary}55` }}
    >
      {/* header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ background: teamColor(p.assignee) }}
          />
          <span className="text-xs font-semibold" style={{ color: COLORS.text }}>
            Preview → @{p.assignee}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {learnedApplied && (
            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "#6366F133", color: "#A5B4FC" }}>
              🧠 Learned rule applied
            </span>
          )}
          {p.edited && (
            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: COLORS.elevated, color: COLORS.muted }}>
              Edited ✏️
            </span>
          )}
        </div>
      </div>

      {/* title */}
      <label className="block text-[10px] uppercase mb-1" style={{ color: COLORS.muted }}>Title</label>
      <input
        value={p.title}
        onChange={(e) => onChange({ title: e.target.value, edited: true })}
        className="w-full px-2.5 py-1.5 rounded-md text-sm mb-2 outline-none"
        style={inputStyle}
      />

      <div className="grid grid-cols-2 gap-2 mb-1">
        {/* assign to */}
        <div>
          <label className="block text-[10px] uppercase mb-1" style={{ color: COLORS.muted }}>Assign To</label>
          <select
            value={p.assignee}
            onChange={(e) => onChange({ assignee: e.target.value, edited: true })}
            disabled={team.length <= 1}
            className="w-full px-2 py-1.5 rounded-md text-sm outline-none disabled:opacity-70"
            style={inputStyle}
          >
            {team.map((m) => (
              <option key={m.name} value={m.name}>{m.name}</option>
            ))}
          </select>
        </div>

        {/* category */}
        <div>
          <label className="block text-[10px] uppercase mb-1" style={{ color: COLORS.muted }}>Category</label>
          <select
            value={p.category}
            onChange={(e) =>
              onChange({ category: e.target.value as Category, edited: true, categoryReason: { type: "default" } })
            }
            className="w-full px-2 py-1.5 rounded-md text-sm outline-none"
            style={{ ...inputStyle, color: CATEGORY_META[p.category].color, borderColor: CATEGORY_META[p.category].color + "88" }}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c} style={{ color: COLORS.text }}>{c}</option>
            ))}
          </select>
          <div className="text-[10px] mt-0.5" style={{ color: COLORS.muted }}>{reasonText(p.categoryReason)}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        {/* priority toggle */}
        <div>
          <label className="block text-[10px] uppercase mb-1" style={{ color: COLORS.muted }}>Priority</label>
          <div className="flex rounded-md overflow-hidden" style={{ border: `1px solid ${COLORS.border}` }}>
            {PRIORITIES.map((pr) => (
              <button
                key={pr}
                onClick={() => onChange({ priority: pr, edited: true, priorityReason: { type: "default" } })}
                className="flex-1 py-1.5 text-[11px] font-semibold"
                style={{
                  background: p.priority === pr ? PRIORITY_COLORS[pr] : COLORS.bg,
                  color: p.priority === pr ? "#fff" : COLORS.muted,
                }}
              >
                {pr}
              </button>
            ))}
          </div>
          <div className="text-[10px] mt-0.5" style={{ color: COLORS.muted }}>{reasonText(p.priorityReason)}</div>
        </div>

        {/* due */}
        <div>
          <label className="block text-[10px] uppercase mb-1" style={{ color: COLORS.muted }}>Due Date</label>
          <input
            value={p.dueLabel}
            placeholder="e.g. Friday"
            onChange={(e) => onChange({ dueLabel: e.target.value, edited: true })}
            className="w-full px-2 py-1.5 rounded-md text-sm outline-none"
            style={inputStyle}
          />
        </div>
      </div>

      {p.notes && (
        <div className="text-[11px] italic mb-2 px-2 py-1 rounded" style={{ background: COLORS.bg, color: COLORS.muted }}>
          {p.notes}
        </div>
      )}

      {p.error && <div className="text-[11px] mb-2" style={{ color: COLORS.danger }}>{p.error}</div>}

      <div className="flex gap-2">
        <button
          onClick={onDiscard}
          className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold flex-1"
          style={{ background: COLORS.bg, color: COLORS.muted, border: `1px solid ${COLORS.border}` }}
        >
          <X size={13} /> Discard
        </button>
        <button
          onClick={onConfirm}
          disabled={p.submitting}
          className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold text-white flex-1 disabled:opacity-50"
          style={{ background: COLORS.success }}
        >
          <Check size={13} /> {p.submitting ? "Assigning…" : "Confirm & Assign"}
        </button>
      </div>
    </div>
  );
}
