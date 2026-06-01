"use client";

import { useState } from "react";
import {
  X,
  Lock,
  Tag as TagIcon,
  MessageSquarePlus,
  ThumbsUp,
  RotateCcw,
} from "lucide-react";
import type { TaskDetail } from "@/lib/types";
import { COLORS, tatColor } from "@/lib/theme";
import { relativeTime, shortDate } from "@/lib/utils";
import { useAuthStore } from "@/lib/store/authStore";
import { useUiStore } from "@/lib/store/uiStore";
import {
  useTask,
  useTransitionStatus,
  usePostUpdate,
  useAddSubtask,
  useUpdateSubtask,
  useUsers,
} from "@/hooks/useApi";
import { apiErrorMessage } from "@/lib/api/axios";
import { Avatar, PriorityBadge, StatusBadge, inputCls, inputStyle } from "./ui";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h3 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: COLORS.muted }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function MetaItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md p-2" style={{ background: COLORS.bg }}>
      <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: COLORS.muted }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function StatusActions({ task }: { task: TaskDetail }) {
  const user = useAuthStore((s) => s.user);
  const openApproval = useUiStore((s) => s.openApproval);
  const transition = useTransitionStatus();
  const [error, setError] = useState("");

  if (!user) return null;
  const isAssignee = user.id === task.assignee.id;
  const isCreator = user.id === task.assigner.id && user.role === "Assigner";

  const go = (status: any) => {
    setError("");
    transition.mutate({ id: task.id, status }, { onError: (e) => setError(apiErrorMessage(e)) });
  };

  const buttons: React.ReactNode[] = [];
  if (isAssignee && task.status === "Queued")
    buttons.push(
      <button
        key="start"
        disabled={task.is_blocked || transition.isPending}
        onClick={() => go("In Progress")}
        title={task.is_blocked ? `Waiting on: ${task.blocking_titles.join(", ")}` : ""}
        className="px-3 py-1.5 rounded-md text-xs font-semibold text-white disabled:opacity-40"
        style={{ background: "#2196F3" }}
      >
        Start Task
      </button>
    );
  if (isAssignee && task.status === "In Progress")
    buttons.push(
      <button key="submit" disabled={transition.isPending} onClick={() => go("Pending Review")}
        className="px-3 py-1.5 rounded-md text-xs font-semibold text-white" style={{ background: "#FF9800" }}>
        Submit for Review
      </button>
    );
  if (isCreator && task.status === "Approved")
    buttons.push(
      <button key="close" disabled={transition.isPending} onClick={() => go("Closed")}
        className="px-3 py-1.5 rounded-md text-xs font-semibold text-white" style={{ background: "#9E9E9E" }}>
        Close Task
      </button>
    );

  return (
    <div className="space-y-2">
      {buttons.length > 0 && <div className="flex flex-wrap gap-2">{buttons}</div>}
      {isCreator && task.status === "Pending Review" && (
        <button
          onClick={() => openApproval(task.id)}
          className="w-full px-3 py-2 rounded-md text-sm font-semibold text-white"
          style={{ background: COLORS.primary }}
        >
          Review Submission
        </button>
      )}
      {error && <p className="text-xs" style={{ color: COLORS.danger }}>{error}</p>}
    </div>
  );
}

function SubTasks({ task }: { task: TaskDetail }) {
  const user = useAuthStore((s) => s.user);
  const isCreator = user?.id === task.assigner.id && user?.role === "Assigner";
  const { data: users } = useUsers(!!isCreator);
  const add = useAddSubtask();
  const update = useUpdateSubtask();
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const subStatusColor: Record<string, string> = { Queued: "#607D8B", "In Progress": "#2196F3", Done: "#4CAF50" };
  const cycle: Record<string, string> = { Queued: "In Progress", "In Progress": "Done", Done: "Queued" };

  return (
    <Section title={`Sub-tasks (${task.subtask_done_count}/${task.subtask_count})`}>
      <SubTaskList task={task} cycle={cycle} subStatusColor={subStatusColor} onToggle={(subId: string, status: string) => update.mutate({ taskId: task.id, subId, status })} />
      {isCreator && (
        <div className="space-y-2 mt-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sub-task title" className={inputCls} style={inputStyle} />
          <div className="flex gap-2">
            <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className={inputCls} style={inputStyle}>
              <option value="">Assignee…</option>
              {(users || []).filter((u) => u.role === "Assignee").map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            <button
              onClick={() => {
                if (!title.trim() || !assigneeId) return;
                add.mutate({ taskId: task.id, title: title.trim(), assignee_id: assigneeId, due_date: task.due_date });
                setTitle(""); setAssigneeId("");
              }}
              className="px-3 rounded-md text-xs font-semibold text-white flex-shrink-0"
              style={{ background: COLORS.primary }}
            >
              Add
            </button>
          </div>
        </div>
      )}
    </Section>
  );
}

function SubTaskList({ task, cycle, subStatusColor, onToggle }: any) {
  // sub-tasks are fetched lazily via a dedicated query
  const { data } = useSubtasksQuery(task.id);
  const user = useAuthStore((s) => s.user);
  if (!data || data.length === 0)
    return <p className="text-xs" style={{ color: COLORS.muted }}>No sub-tasks.</p>;
  return (
    <div className="space-y-1.5">
      {data.map((s: any) => {
        const canToggle = user?.id === s.assignee.id || (user?.id === task.assigner.id);
        return (
          <div key={s.id} className="flex items-center gap-2 p-2 rounded" style={{ background: COLORS.bg }}>
            <button disabled={!canToggle} onClick={() => onToggle(s.id, cycle[s.status])} className="flex-shrink-0 disabled:opacity-50">
              <StatusBadge status={s.status} />
            </button>
            <span className="text-xs flex-1" style={{ color: COLORS.text, textDecoration: s.status === "Done" ? "line-through" : "none", opacity: s.status === "Done" ? 0.6 : 1 }}>
              {s.title}
            </span>
            <Avatar user={s.assignee} size={20} />
          </div>
        );
      })}
    </div>
  );
}

// local hook to avoid circular import noise
import { useQuery } from "@tanstack/react-query";
import { fetchSubtasks } from "@/lib/api/endpoints";
function useSubtasksQuery(taskId: string) {
  return useQuery({ queryKey: ["subtasks", taskId], queryFn: () => fetchSubtasks(taskId) });
}

function Progress({ task }: { task: TaskDetail }) {
  const user = useAuthStore((s) => s.user);
  const post = usePostUpdate();
  const isAssignee = user?.id === task.assignee.id;
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const canPost = isAssignee && (task.status === "In Progress" || task.status === "Pending Review");

  return (
    <Section title={`Progress Updates (${task.progress_updates.length})`}>
      <div className="space-y-2 mb-2">
        {task.progress_updates.map((u) => (
          <div key={u.id} className="p-2.5 rounded" style={{ background: COLORS.bg, borderLeft: `2px solid ${COLORS.primary}` }}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold">
                {u.user_id === task.assignee.id ? task.assignee.name : task.assigner.name}
              </span>
              <span className="text-[10px] font-mono" style={{ color: COLORS.muted }}>{relativeTime(u.created_at)}</span>
            </div>
            <p className="text-xs"><span style={{ color: COLORS.muted }}>Now: </span>{u.current_work}</p>
            {u.next_steps && <p className="text-xs mt-0.5"><span style={{ color: COLORS.muted }}>Next: </span>{u.next_steps}</p>}
          </div>
        ))}
        {task.progress_updates.length === 0 && <p className="text-xs" style={{ color: COLORS.muted }}>No updates yet.</p>}
      </div>
      {canPost && (
        <div className="space-y-2">
          <textarea value={cur} onChange={(e) => setCur(e.target.value)} placeholder="What did you work on?" rows={2} className={inputCls} style={inputStyle} />
          <textarea value={next} onChange={(e) => setNext(e.target.value)} placeholder="Next steps…" rows={2} className={inputCls} style={inputStyle} />
          <button
            onClick={() => { if (!cur.trim()) return; post.mutate({ id: task.id, current_work: cur.trim(), next_steps: next.trim() }); setCur(""); setNext(""); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-white"
            style={{ background: COLORS.primary }}
          >
            <MessageSquarePlus size={14} /> Add Update
          </button>
        </div>
      )}
    </Section>
  );
}

function ApprovalHistory({ task }: { task: TaskDetail }) {
  if (task.approval_events.length === 0) return null;
  return (
    <Section title="Approval History">
      <div className="space-y-2">
        {task.approval_events.map((e) => {
          const approved = e.action === "Approved";
          return (
            <div key={e.id} className="p-2.5 rounded" style={{ background: COLORS.bg }}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  {approved ? <ThumbsUp size={13} style={{ color: "#4CAF50" }} /> : <RotateCcw size={13} style={{ color: "#FF9800" }} />}
                  <span className="text-[11px] font-semibold">{e.action}</span>
                </div>
                <span className="text-[10px] font-mono" style={{ color: COLORS.muted }}>{relativeTime(e.created_at)}</span>
              </div>
              {e.comment && <p className="text-xs" style={{ color: COLORS.muted }}>&quot;{e.comment}&quot;</p>}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

export function TaskDetailPanel() {
  const selectedTaskId = useUiStore((s) => s.selectedTaskId);
  const selectTask = useUiStore((s) => s.selectTask);
  const { data: task } = useTask(selectedTaskId);
  const open = !!selectedTaskId;

  return (
    <div
      className="fixed top-0 right-0 h-screen z-40"
      style={{
        width: 380,
        transform: open ? "translateX(0)" : "translateX(110%)",
        transition: "transform 200ms ease",
      }}
    >
      <div className="w-full h-full overflow-y-auto p-5" style={{ background: COLORS.surface, borderLeft: `1px solid ${COLORS.border}` }}>
        {task && (
          <>
            <div className="flex items-start justify-between mb-3">
              <StatusBadge status={task.status} />
              <button onClick={() => selectTask(null)} className="p-1 rounded" style={{ color: COLORS.muted }}>
                <X size={18} />
              </button>
            </div>

            <h2 className="text-lg font-bold mb-1">{task.title}</h2>
            <p className="text-sm mb-3" style={{ color: COLORS.muted }}>{task.description || "No description."}</p>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <MetaItem label="Priority"><PriorityBadge priority={task.priority} /></MetaItem>
              <MetaItem label="Due"><span className="text-sm font-mono" style={{ color: tatColor(task.tat) }}>{shortDate(task.due_date)}</span></MetaItem>
              <MetaItem label="Effort"><span className="text-sm">{task.estimated_effort ?? "—"} {task.effort_unit}</span></MetaItem>
              <MetaItem label="TAT"><span className="text-sm font-mono">{task.tat.tat_label}{!task.approved_at && " (elapsed)"}</span></MetaItem>
            </div>

            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <Avatar user={task.assigner} size={28} />
                <div>
                  <div className="text-[10px] uppercase" style={{ color: COLORS.muted }}>Assigner</div>
                  <div className="text-xs font-semibold">{task.assigner.name}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Avatar user={task.assignee} size={28} />
                <div>
                  <div className="text-[10px] uppercase" style={{ color: COLORS.muted }}>Assignee</div>
                  <div className="text-xs font-semibold">{task.assignee.name}</div>
                </div>
              </div>
            </div>

            {task.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {task.tags.map((tag) => (
                  <span key={tag.name} className="text-[11px] px-2 py-0.5 rounded flex items-center gap-1" style={{ background: COLORS.elevated, color: COLORS.muted }}>
                    <TagIcon size={10} />{tag.name}
                  </span>
                ))}
              </div>
            )}

            {task.is_blocked && (
              <div className="flex items-center gap-2 p-2.5 rounded-md mb-4" style={{ background: "#F4433622", border: "1px solid #F4433655" }}>
                <Lock size={14} style={{ color: "#F44336" }} />
                <span className="text-xs">Waiting on: {task.blocking_titles.join(", ")}</span>
              </div>
            )}

            <div className="mb-4"><StatusActions task={task} /></div>

            <div style={{ borderTop: `1px solid ${COLORS.border}` }} className="pt-4">
              <SubTasks task={task} />
              <Progress task={task} />
              <ApprovalHistory task={task} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
