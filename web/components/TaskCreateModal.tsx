"use client";

import { useState } from "react";
import { X, CornerDownRight } from "lucide-react";
import { COLORS, PRIORITIES } from "@/lib/theme";
import { useUiStore } from "@/lib/store/uiStore";
import { useCreateTask, useTasks, useUsers } from "@/hooks/useApi";
import { apiErrorMessage } from "@/lib/api/axios";
import { Modal, StatusBadge, inputCls, inputStyle } from "./ui";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="block text-xs font-semibold mb-1" style={{ color: COLORS.muted }}>{label}</label>
      {children}
    </div>
  );
}

export function TaskCreateModal() {
  const open = useUiStore((s) => s.createOpen);
  const parentId = useUiStore((s) => s.createParentId);
  const close = useUiStore((s) => s.closeCreate);
  const selectTask = useUiStore((s) => s.selectTask);
  const create = useCreateTask();
  const { data: users } = useUsers(open);
  const { data: tasksPage } = useTasks(open ? {} : { per_page: 1 });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  );
  const [assigneeId, setAssigneeId] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [effort, setEffort] = useState(4);
  const [effortUnit, setEffortUnit] = useState("hours");
  const [dependsOn, setDependsOn] = useState<string[]>([]);
  const [error, setError] = useState("");

  if (!open) return null;

  const assignees = (users || []).filter((u) => u.role === "Assignee");
  const existingTasks = tasksPage?.data || [];
  const parent = existingTasks.find((t) => t.id === parentId);

  const addTag = () => {
    const v = tagInput.trim().replace(/,/g, "");
    if (v && !tags.includes(v)) setTags([...tags, v]);
    setTagInput("");
  };

  const reset = () => {
    setTitle(""); setDescription(""); setPriority("Medium"); setAssigneeId("");
    setTags([]); setTagInput(""); setEffort(4); setEffortUnit("hours"); setDependsOn([]); setError("");
  };

  const submit = () => {
    if (!title.trim()) return setError("Title is required");
    if (!assigneeId) return setError("Please select an assignee");
    create.mutate(
      {
        title: title.trim(),
        description,
        priority,
        assignee_id: assigneeId,
        due_date: dueDate,
        estimated_effort: Number(effort),
        effort_unit: effortUnit,
        tags,
        depends_on_task_ids: dependsOn,
        parent_task_id: parentId,
      },
      {
        onSuccess: (task) => { reset(); close(); selectTask(task.id); },
        onError: (e) => setError(apiErrorMessage(e)),
      }
    );
  };

  return (
    <Modal title="Create Task" onClose={() => { reset(); close(); }} wide>
      {parent && (
        <div className="mb-3 p-2 rounded-md text-xs flex items-center gap-2" style={{ background: COLORS.primary + "22", color: COLORS.primary }}>
          <CornerDownRight size={14} /> Follow-up to: {parent.title}
        </div>
      )}

      <Field label="Title *">
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} style={inputStyle} placeholder="Task title" />
      </Field>
      <Field label="Description">
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={inputCls} style={inputStyle} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Priority">
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputCls} style={inputStyle}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Due Date">
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} style={inputStyle} />
        </Field>
      </div>

      <Field label="Assignee *">
        <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className={inputCls} style={inputStyle}>
          <option value="">Select assignee…</option>
          {assignees.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </Field>

      <Field label="Tags">
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {tags.map((t) => (
            <span key={t} className="text-[11px] px-2 py-0.5 rounded flex items-center gap-1" style={{ background: COLORS.elevated }}>
              #{t}
              <button onClick={() => setTags(tags.filter((x) => x !== t))}><X size={11} /></button>
            </span>
          ))}
        </div>
        <input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); } }}
          className={inputCls} style={inputStyle} placeholder="Type a tag and press Enter"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Estimated Effort">
          <input type="number" min={0} value={effort} onChange={(e) => setEffort(Number(e.target.value))} className={inputCls} style={inputStyle} />
        </Field>
        <Field label="Unit">
          <div className="flex rounded-md overflow-hidden" style={{ border: `1px solid ${COLORS.border}` }}>
            {["hours", "points"].map((u) => (
              <button key={u} onClick={() => setEffortUnit(u)} className="flex-1 py-2 text-xs font-semibold capitalize"
                style={{ background: effortUnit === u ? COLORS.primary : COLORS.bg, color: effortUnit === u ? "#fff" : COLORS.muted }}>
                {u}
              </button>
            ))}
          </div>
        </Field>
      </div>

      <Field label="Depends On (must be Approved first)">
        <div className="rounded-md p-2 max-h-28 overflow-y-auto space-y-1" style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}` }}>
          {existingTasks.length === 0 && <span className="text-xs" style={{ color: COLORS.muted }}>No existing tasks</span>}
          {existingTasks.filter((t) => !t.parent_task_id).map((t) => (
            <label key={t.id} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={dependsOn.includes(t.id)}
                onChange={(e) => setDependsOn(e.target.checked ? [...dependsOn, t.id] : dependsOn.filter((x) => x !== t.id))}
              />
              <span className="text-xs flex-1">{t.title}</span>
              <StatusBadge status={t.status} />
            </label>
          ))}
        </div>
      </Field>

      {error && <p className="text-xs mb-2" style={{ color: COLORS.danger }}>{error}</p>}

      <div className="flex gap-2 mt-2">
        <button onClick={() => { reset(); close(); }} className="px-4 py-2 rounded-md text-sm" style={{ background: COLORS.bg, color: COLORS.muted }}>
          Cancel
        </button>
        <button onClick={submit} disabled={create.isPending} className="flex-1 py-2 rounded-md text-sm font-semibold text-white disabled:opacity-50" style={{ background: COLORS.primary }}>
          {create.isPending ? "Creating…" : "Create Task"}
        </button>
      </div>
    </Modal>
  );
}
