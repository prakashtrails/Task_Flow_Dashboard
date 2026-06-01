"use client";

import { Lock } from "lucide-react";
import type { TaskSummary } from "@/lib/types";
import { COLORS, tatColor } from "@/lib/theme";
import { shortDate } from "@/lib/utils";
import { useUiStore } from "@/lib/store/uiStore";
import { Avatar, PriorityBadge } from "./ui";

export function TaskCard({ task }: { task: TaskSummary }) {
  const selectTask = useUiStore((s) => s.selectTask);
  const blocked = task.is_blocked;

  return (
    <div
      onClick={() => selectTask(task.id)}
      className="task-card relative rounded-lg p-3 cursor-pointer mb-2"
      style={{
        background: COLORS.surface,
        borderLeft: `3px solid ${tatColor(task.tat)}`,
        border: `1px solid ${COLORS.border}`,
        borderLeftWidth: 3,
        borderLeftColor: tatColor(task.tat),
        opacity: blocked ? 0.6 : 1,
      }}
    >
      {blocked && (
        <div className="absolute top-2 right-2" title="Blocked by dependency">
          <Lock size={14} style={{ color: COLORS.muted }} />
        </div>
      )}
      <div className="text-sm font-semibold leading-snug mb-2 pr-4">
        {task.title}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        <PriorityBadge priority={task.priority} />
        {task.tags.slice(0, 2).map((t) => (
          <span
            key={t.name}
            className="text-[10px] px-1.5 py-0.5 rounded"
            style={{ background: COLORS.elevated, color: COLORS.muted }}
          >
            #{t.name}
          </span>
        ))}
        {task.subtask_count > 0 && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded font-mono"
            style={{ background: COLORS.elevated, color: COLORS.muted }}
          >
            {task.subtask_done_count}/{task.subtask_count}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Avatar user={task.assignee} size={24} />
          <span
            className="text-[11px] font-mono px-1.5 py-0.5 rounded"
            style={{
              color: task.tat.is_overdue ? "#fff" : tatColor(task.tat),
              background: task.tat.is_overdue
                ? COLORS.danger
                : tatColor(task.tat) + "22",
            }}
          >
            {shortDate(task.due_date)}
          </span>
        </div>
        {task.estimated_effort != null && (
          <span className="text-[11px]" style={{ color: COLORS.muted }}>
            {task.estimated_effort}
            {task.effort_unit === "hours" ? "h" : "pt"}
          </span>
        )}
      </div>
    </div>
  );
}
