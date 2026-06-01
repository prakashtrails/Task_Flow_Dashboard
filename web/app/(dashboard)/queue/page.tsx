"use client";

import { Fragment, useMemo } from "react";
import { ArrowRight, Lock } from "lucide-react";
import { useTasks } from "@/hooks/useApi";
import { useUiStore } from "@/lib/store/uiStore";
import { COLORS, STATUS_COLORS, tatColor } from "@/lib/theme";
import { shortDate } from "@/lib/utils";
import { Avatar, StatusBadge } from "@/components/ui";
import type { TaskSummary } from "@/lib/types";

export default function QueuePage() {
  const { data } = useTasks({});
  const selectTask = useUiStore((s) => s.selectTask);
  const tasks = data?.data || [];

  const chains = useMemo(() => {
    const byId: Record<string, TaskSummary> = {};
    tasks.forEach((t) => (byId[t.id] = t));
    const involved = tasks.filter(
      (t) =>
        (t.depends_on_task_ids && t.depends_on_task_ids.length) ||
        tasks.some((o) => o.depends_on_task_ids.includes(t.id))
    );
    const adj: Record<string, Set<string>> = {};
    involved.forEach((t) => (adj[t.id] = new Set()));
    involved.forEach((t) => {
      t.depends_on_task_ids.forEach((d) => {
        if (adj[d]) {
          adj[t.id].add(d);
          adj[d].add(t.id);
        }
      });
    });
    const seen = new Set<string>();
    const groups: TaskSummary[][] = [];
    involved.forEach((t) => {
      if (seen.has(t.id)) return;
      const stack = [t.id];
      const grp: string[] = [];
      while (stack.length) {
        const id = stack.pop()!;
        if (seen.has(id)) continue;
        seen.add(id);
        grp.push(id);
        adj[id].forEach((n) => !seen.has(n) && stack.push(n));
      }
      grp.sort((a, b) => byId[a].depends_on_task_ids.length - byId[b].depends_on_task_ids.length);
      groups.push(grp.map((id) => byId[id]));
    });
    return groups;
  }, [tasks]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-wide">Queue & Dependency Chains</h1>
        <p className="text-sm" style={{ color: COLORS.muted }}>
          Tasks connected by dependencies. Dimmed nodes are blocked.
        </p>
      </div>

      {chains.length === 0 && (
        <div className="rounded-lg p-8 text-center text-sm" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, color: COLORS.muted }}>
          No dependency chains yet.
        </div>
      )}

      {chains.map((chain, i) => (
        <div key={i} className="rounded-lg p-4 overflow-x-auto" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
          <div className="flex items-center gap-1 min-w-min">
            {chain.map((t, idx) => (
              <Fragment key={t.id}>
                <div
                  onClick={() => selectTask(t.id)}
                  className="task-card flex-shrink-0 w-[180px] rounded-lg p-3 cursor-pointer"
                  style={{ background: COLORS.bg, border: `1px solid ${t.is_blocked ? COLORS.border : STATUS_COLORS[t.status]}`, opacity: t.is_blocked ? 0.55 : 1 }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <StatusBadge status={t.status} />
                    {t.is_blocked && <Lock size={12} style={{ color: COLORS.muted }} />}
                  </div>
                  <div className="text-sm font-semibold mb-2 leading-snug">{t.title}</div>
                  <div className="flex items-center justify-between">
                    <Avatar user={t.assignee} size={22} />
                    <span className="text-[10px] font-mono" style={{ color: tatColor(t.tat) }}>{shortDate(t.due_date)}</span>
                  </div>
                </div>
                {idx < chain.length - 1 && <ArrowRight size={20} className="flex-shrink-0" style={{ color: COLORS.muted }} />}
              </Fragment>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
