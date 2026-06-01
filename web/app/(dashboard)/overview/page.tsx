"use client";

import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { AlertTriangle, Clock } from "lucide-react";
import { useAuthStore } from "@/lib/store/authStore";
import { useDashboard, useTeamWorkload, useTasks } from "@/hooks/useApi";
import { useUiStore } from "@/lib/store/uiStore";
import { COLORS, STATUS_COLORS } from "@/lib/theme";
import { shortDate } from "@/lib/utils";

function MetricCard({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) {
  return (
    <div className="rounded-lg p-4 flex-1 min-w-[140px]" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
      <div className="text-xs font-semibold mb-1" style={{ color: COLORS.muted }}>{label}</div>
      <div className="text-2xl font-bold" style={{ color: accent || COLORS.text }}>{value}</div>
    </div>
  );
}

function fmtHours(h: number | null | undefined) {
  if (h == null) return "—";
  if (h >= 24) return `${Math.round(h / 24)}d`;
  return `${h.toFixed(1)}h`;
}

export default function OverviewPage() {
  const user = useAuthStore((s) => s.user);
  const isAssigner = user?.role === "Assigner";
  const { data: metrics } = useDashboard();
  const { data: workload } = useTeamWorkload(!!isAssigner);
  const { data: tasksPage } = useTasks({});
  const selectTask = useUiStore((s) => s.selectTask);

  if (!user) return null;

  const statusData = (metrics?.status_distribution || []).filter((d) => d.count > 0);
  const overdueTasks = (tasksPage?.data || []).filter((t) => t.tat.is_overdue && !t.parent_task_id);
  const workloadData = (workload || []).map((w) => ({ name: w.user.avatar, fullName: w.user.name, value: w.in_progress }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-wide">{isAssigner ? "Team Dashboard" : "My Dashboard"}</h1>
        <p className="text-sm" style={{ color: COLORS.muted }}>
          {isAssigner ? "Overview of all team activity and metrics" : `Your personal metrics, ${user.name}`}
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <MetricCard label="Total Tasks" value={metrics?.total_tasks ?? "—"} />
        <MetricCard label="Overdue" value={metrics?.overdue_count ?? "—"} accent={metrics?.overdue_count ? COLORS.danger : COLORS.text} />
        <MetricCard label="Avg TAT" value={fmtHours(metrics?.avg_tat_hours)} />
        <MetricCard label="In Progress" value={statusData.find((d) => d.status === "In Progress")?.count ?? 0} accent="#2196F3" />
      </div>

      {isAssigner && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-lg p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
            <h3 className="text-sm font-bold mb-2">Status Distribution</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={statusData} dataKey="count" nameKey="status" innerRadius={45} outerRadius={75} paddingAngle={2}>
                  {statusData.map((d) => <Cell key={d.status} fill={STATUS_COLORS[d.status]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: COLORS.elevated, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.text }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-2 justify-center mt-1">
              {statusData.map((d) => (
                <div key={d.status} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[d.status] }} />
                  <span className="text-[11px]" style={{ color: COLORS.muted }}>{d.status} ({d.count})</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
            <h3 className="text-sm font-bold mb-2">Team Workload (In Progress)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={workloadData}>
                <XAxis dataKey="name" tick={{ fill: COLORS.muted, fontSize: 12 }} axisLine={{ stroke: COLORS.border }} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: COLORS.muted, fontSize: 12 }} axisLine={{ stroke: COLORS.border }} tickLine={false} />
                <Tooltip cursor={{ fill: COLORS.elevated }} contentStyle={{ background: COLORS.elevated, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.text }}
                  formatter={(v: any, _n: any, p: any) => [v, p.payload.fullName]} />
                <Bar dataKey="value" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg p-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} style={{ color: COLORS.danger }} />
            <h3 className="text-sm font-bold">Overdue Tasks ({overdueTasks.length})</h3>
          </div>
          <div className="space-y-1.5">
            {overdueTasks.length === 0 && <p className="text-xs" style={{ color: COLORS.muted }}>Nothing overdue. 🎉</p>}
            {overdueTasks.map((t) => (
              <button key={t.id} onClick={() => selectTask(t.id)} className="w-full text-left flex items-center justify-between px-2 py-1.5 rounded" style={{ background: COLORS.bg }}>
                <span className="text-xs">{t.title}</span>
                <span className="text-[10px] font-mono" style={{ color: COLORS.danger }}>due {shortDate(t.due_date)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg p-4 flex flex-col justify-center" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
          <div className="flex items-center gap-2 mb-1">
            <Clock size={16} style={{ color: COLORS.primary }} />
            <h3 className="text-sm font-bold">{isAssigner ? "Team" : "Your"} Average TAT</h3>
          </div>
          <div className="text-3xl font-bold" style={{ color: COLORS.primary }}>{fmtHours(metrics?.avg_tat_hours)}</div>
          <p className="text-[11px] mt-1" style={{ color: COLORS.muted }}>across approved/closed tasks</p>
        </div>
      </div>
    </div>
  );
}
