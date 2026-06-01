"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { COLORS } from "@/lib/theme";
import { ALL_MEMBERS, CATEGORY_META, PRIORITY_COLORS, teamColor } from "@/lib/prakash/constants";
import { getTasks, removeTask, updateTask, PrakashTask } from "@/lib/prakash/store";
import { api } from "@/lib/api/axios";

export function TasksTab({
  userKey,
  version,
  onChanged,
}: {
  userKey: string;
  version: number; // bump to force re-read from localStorage
  onChanged: () => void;
}) {
  const [filter, setFilter] = useState<string>("all");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tasks = useMemo<PrakashTask[]>(() => getTasks(userKey), [version, userKey]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of tasks) c[t.assignee] = (c[t.assignee] || 0) + 1;
    return c;
  }, [tasks]);

  const shown = tasks
    .filter((t) => filter === "all" || t.assignee === filter)
    .sort((a, b) => Number(a.done) - Number(b.done) || b.ts - a.ts);

  const toggleDone = (t: PrakashTask) => {
    updateTask(userKey, t.id, { done: !t.done });
    onChanged();
  };

  const del = async (t: PrakashTask) => {
    removeTask(userKey, t.id);
    onChanged();
    // best-effort: also soft-delete the task on the main board
    try {
      await api.delete(`/tasks/${t.id}`);
    } catch {
      /* ignore — board task may belong to another assigner */
    }
  };

  return (
    <div className="h-[calc(100vh-180px)] overflow-y-auto pr-1">
      {/* filter bar */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <button
          onClick={() => setFilter("all")}
          className="text-xs px-2.5 py-1 rounded-full font-medium"
          style={{
            background: filter === "all" ? COLORS.primary : COLORS.elevated,
            color: filter === "all" ? "#fff" : COLORS.muted,
          }}
        >
          All tasks ({tasks.length})
        </button>
        {ALL_MEMBERS.filter((m) => counts[m.name]).map((m) => (
          <button
            key={m.name}
            onClick={() => setFilter(m.name)}
            className="text-xs px-2.5 py-1 rounded-full font-medium"
            style={{
              background: filter === m.name ? m.color : m.color + "22",
              color: filter === m.name ? "#fff" : m.color,
            }}
          >
            {m.name} ({counts[m.name]})
          </button>
        ))}
      </div>

      {shown.length === 0 && (
        <div className="text-center text-sm mt-10" style={{ color: COLORS.muted }}>
          No tasks yet. Assign some from the Chat tab.
        </div>
      )}

      <div className="space-y-2">
        {shown.map((t) => (
          <div
            key={t.id}
            className="group rounded-lg p-3"
            style={{
              background: COLORS.surface,
              border: `1px solid ${COLORS.border}`,
              opacity: t.done ? 0.55 : 1,
            }}
          >
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={t.done}
                onChange={() => toggleDone(t)}
                className="mt-1 flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div
                  className="text-sm font-semibold mb-1.5"
                  style={{ color: COLORS.text, textDecoration: t.done ? "line-through" : "none" }}
                >
                  {t.title}
                </div>
                <div className="flex flex-wrap gap-1.5 items-center">
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded font-semibold text-white"
                    style={{ background: teamColor(t.assignee) }}
                  >
                    {t.assignee}
                  </span>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                    style={{ background: CATEGORY_META[t.category].color + "22", color: CATEGORY_META[t.category].color }}
                  >
                    {t.category}
                  </span>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded font-semibold text-white"
                    style={{ background: PRIORITY_COLORS[t.priority] }}
                  >
                    {t.priority}
                  </span>
                  {t.dueLabel && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: COLORS.elevated, color: COLORS.muted }}>
                      📅 {t.dueLabel}
                    </span>
                  )}
                  {t.corrected && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "#6366F133", color: "#A5B4FC" }}>
                      🧠 Corrected
                    </span>
                  )}
                </div>
                {t.notes && (
                  <div className="text-[11px] italic mt-1.5" style={{ color: COLORS.muted }}>
                    {t.notes.slice(0, 100)}
                    {t.notes.length > 100 ? "…" : ""}
                  </div>
                )}
                <div className="text-[10px] mt-1 font-mono" style={{ color: COLORS.muted }}>
                  via Prakash · {new Date(t.ts).toLocaleString()}
                </div>
              </div>
              <button
                onClick={() => del(t)}
                className="opacity-0 group-hover:opacity-100 transition flex-shrink-0 p-1"
                style={{ color: COLORS.muted }}
                title="Delete"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
