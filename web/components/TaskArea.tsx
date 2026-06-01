"use client";

import { useMemo, useState } from "react";
import { LayoutGrid, List as ListIcon, Lock } from "lucide-react";
import type { TaskSummary } from "@/lib/types";
import { COLORS, STATUSES, STATUS_COLORS, tatColor } from "@/lib/theme";
import { shortDate } from "@/lib/utils";
import { useUiStore } from "@/lib/store/uiStore";
import { TaskCard } from "./TaskCard";
import { Avatar, PriorityBadge, StatusBadge } from "./ui";

function KanbanBoard({ tasks }: { tasks: TaskSummary[] }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 h-full">
      {STATUSES.map((status) => {
        const col = tasks.filter((t) => t.status === status);
        return (
          <div
            key={status}
            className="flex-shrink-0 w-[240px] flex flex-col rounded-lg"
            style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}` }}
          >
            <div
              className="flex items-center justify-between px-3 py-2 rounded-t-lg"
              style={{ borderBottom: `2px solid ${STATUS_COLORS[status]}` }}
            >
              <span className="text-xs font-bold">{status}</span>
              <span
                className="text-[11px] font-bold rounded-full px-1.5"
                style={{ background: COLORS.elevated, color: COLORS.muted }}
              >
                {col.length}
              </span>
            </div>
            <div className="p-2 flex-1 overflow-y-auto max-h-[calc(100vh-220px)]">
              {col.map((t) => (
                <TaskCard key={t.id} task={t} />
              ))}
              {col.length === 0 && (
                <div className="text-center text-xs py-6" style={{ color: COLORS.muted }}>
                  Empty
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

type SortKey = "title" | "priority" | "status" | "assignee" | "due_date" | "tat";

function ListView({ tasks }: { tasks: TaskSummary[] }) {
  const selectTask = useUiStore((s) => s.selectTask);
  const [sortKey, setSortKey] = useState<SortKey>("due_date");
  const [asc, setAsc] = useState(true);

  const sorted = useMemo(() => {
    const arr = [...tasks];
    const prio = ["Low", "Medium", "High", "Critical"];
    arr.sort((a, b) => {
      let av: any, bv: any;
      switch (sortKey) {
        case "title": av = a.title.toLowerCase(); bv = b.title.toLowerCase(); break;
        case "priority": av = prio.indexOf(a.priority); bv = prio.indexOf(b.priority); break;
        case "status": av = STATUSES.indexOf(a.status); bv = STATUSES.indexOf(b.status); break;
        case "assignee": av = a.assignee.name; bv = b.assignee.name; break;
        case "tat": av = a.tat.tat_hours; bv = b.tat.tat_hours; break;
        default: av = a.due_date; bv = b.due_date;
      }
      if (av < bv) return asc ? -1 : 1;
      if (av > bv) return asc ? 1 : -1;
      return 0;
    });
    return arr;
  }, [tasks, sortKey, asc]);

  const cols: { key: SortKey | "tags"; label: string }[] = [
    { key: "title", label: "Title" },
    { key: "priority", label: "Priority" },
    { key: "status", label: "Status" },
    { key: "assignee", label: "Assignee" },
    { key: "due_date", label: "Due" },
    { key: "tat", label: "TAT" },
    { key: "tags", label: "Tags" },
  ];

  const setSort = (k: SortKey | "tags") => {
    if (k === "tags") return;
    if (sortKey === k) setAsc((a) => !a);
    else { setSortKey(k); setAsc(true); }
  };

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${COLORS.border}` }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: COLORS.elevated }}>
            {cols.map((c) => (
              <th
                key={c.key}
                onClick={() => setSort(c.key)}
                className="text-left px-3 py-2 text-xs font-bold cursor-pointer select-none"
                style={{ color: COLORS.muted }}
              >
                {c.label}
                {sortKey === c.key ? (asc ? " ▲" : " ▼") : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((t) => (
            <tr
              key={t.id}
              onClick={() => selectTask(t.id)}
              className="cursor-pointer"
              style={{
                background: COLORS.surface,
                borderBottom: `1px solid ${COLORS.border}`,
                borderLeft: t.tat.is_overdue ? "3px solid #F44336" : "3px solid transparent",
              }}
            >
              <td className="px-3 py-2">
                <div className="flex items-center gap-1.5">
                  {t.is_blocked && <Lock size={12} style={{ color: COLORS.muted }} />}
                  {t.title}
                </div>
              </td>
              <td className="px-3 py-2"><PriorityBadge priority={t.priority} /></td>
              <td className="px-3 py-2"><StatusBadge status={t.status} /></td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <Avatar user={t.assignee} size={22} />
                  <span style={{ color: COLORS.muted }} className="text-xs">{t.assignee.name}</span>
                </div>
              </td>
              <td className="px-3 py-2 font-mono text-xs" style={{ color: tatColor(t.tat) }}>
                {shortDate(t.due_date)}
              </td>
              <td className="px-3 py-2 font-mono text-xs" style={{ color: COLORS.muted }}>
                {t.tat.tat_label}{!t.approved_at && "*"}
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-1">
                  {t.tags.map((tag) => (
                    <span key={tag.name} className="text-[10px] px-1 rounded" style={{ background: COLORS.elevated, color: COLORS.muted }}>
                      #{tag.name}
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {sorted.length === 0 && (
        <div className="text-center py-10 text-sm" style={{ color: COLORS.muted, background: COLORS.surface }}>
          No tasks.
        </div>
      )}
    </div>
  );
}

export function TaskArea({
  title,
  subtitle,
  tasks,
  loading,
}: {
  title: string;
  subtitle?: string;
  tasks: TaskSummary[];
  loading?: boolean;
}) {
  const viewMode = useUiStore((s) => s.viewMode);
  const setViewMode = useUiStore((s) => s.setViewMode);
  // Only show top-level tasks on the board (sub-tasks live inside detail panel)
  const topLevel = tasks.filter((t) => !t.parent_task_id);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold tracking-wide">{title}</h1>
          {subtitle && <p className="text-sm" style={{ color: COLORS.muted }}>{subtitle}</p>}
        </div>
        <div className="flex rounded-md overflow-hidden" style={{ border: `1px solid ${COLORS.border}` }}>
          <button
            onClick={() => setViewMode("board")}
            className="p-1.5"
            style={{ background: viewMode === "board" ? COLORS.primary + "33" : "transparent", color: viewMode === "board" ? COLORS.primary : COLORS.muted }}
          >
            <LayoutGrid size={16} />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className="p-1.5"
            style={{ background: viewMode === "list" ? COLORS.primary + "33" : "transparent", color: viewMode === "list" ? COLORS.primary : COLORS.muted }}
          >
            <ListIcon size={16} />
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="text-sm" style={{ color: COLORS.muted }}>Loading tasks…</div>
        ) : viewMode === "board" ? (
          <KanbanBoard tasks={topLevel} />
        ) : (
          <ListView tasks={topLevel} />
        )}
      </div>
    </div>
  );
}
