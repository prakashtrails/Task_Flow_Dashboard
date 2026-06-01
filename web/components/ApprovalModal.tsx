"use client";

import { useState } from "react";
import { ThumbsUp, RotateCcw, CheckCircle2, Plus, CornerDownRight } from "lucide-react";
import { COLORS } from "@/lib/theme";
import { useUiStore } from "@/lib/store/uiStore";
import { useTask, useApproveTask, useRequestChanges } from "@/hooks/useApi";
import { apiErrorMessage } from "@/lib/api/axios";
import { relativeTime } from "@/lib/utils";
import { Modal, PriorityBadge, inputCls, inputStyle } from "./ui";

type Stage = "review" | "requestChanges" | "followUp";

export function ApprovalModal() {
  const taskId = useUiStore((s) => s.approvalTaskId);
  const close = useUiStore((s) => s.closeApproval);
  const openCreate = useUiStore((s) => s.openCreate);
  const selectTask = useUiStore((s) => s.selectTask);
  const { data: task } = useTask(taskId);
  const approve = useApproveTask();
  const requestChanges = useRequestChanges();

  const [stage, setStage] = useState<Stage>("review");
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");

  if (!taskId || !task) return null;

  const onClose = () => { setStage("review"); setComment(""); setError(""); close(); };

  return (
    <Modal title="Review Submission" onClose={onClose} wide>
      {stage === "review" && (
        <>
          <div className="mb-3 p-3 rounded-md" style={{ background: COLORS.bg }}>
            <div className="font-bold text-sm">{task.title}</div>
            <p className="text-xs mt-1" style={{ color: COLORS.muted }}>{task.description}</p>
            <div className="flex gap-2 mt-2 items-center">
              <PriorityBadge priority={task.priority} />
              <span className="text-xs" style={{ color: COLORS.muted }}>Assignee: {task.assignee.name}</span>
            </div>
          </div>

          <h3 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: COLORS.muted }}>Progress Log</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto mb-2">
            {task.progress_updates.map((u) => (
              <div key={u.id} className="p-2 rounded text-xs" style={{ background: COLORS.bg }}>
                <div className="flex justify-between mb-0.5">
                  <span className="font-semibold">Update</span>
                  <span className="font-mono" style={{ color: COLORS.muted }}>{relativeTime(u.created_at)}</span>
                </div>
                <div>{u.current_work}</div>
                {u.next_steps && <div style={{ color: COLORS.muted }}>Next: {u.next_steps}</div>}
              </div>
            ))}
            {task.progress_updates.length === 0 && <p className="text-xs" style={{ color: COLORS.muted }}>No progress updates were posted.</p>}
          </div>

          {error && <p className="text-xs mb-2" style={{ color: COLORS.danger }}>{error}</p>}

          <div className="flex gap-2 mt-4">
            <button onClick={() => setStage("requestChanges")} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-semibold"
              style={{ background: "#FF980022", color: "#FF9800", border: "1px solid #FF980055" }}>
              <RotateCcw size={15} /> Request Changes
            </button>
            <button
              disabled={approve.isPending}
              onClick={() => approve.mutate({ id: task.id, comment: "" }, { onSuccess: () => setStage("followUp"), onError: (e) => setError(apiErrorMessage(e)) })}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "#4CAF50" }}>
              <ThumbsUp size={15} /> Approve
            </button>
          </div>
        </>
      )}

      {stage === "requestChanges" && (
        <>
          <p className="text-sm mb-2">Describe the changes needed (required):</p>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={4} placeholder="What needs to change?" className={inputCls} style={inputStyle} />
          {error && <p className="text-xs mt-2" style={{ color: COLORS.danger }}>{error}</p>}
          <div className="flex gap-2 mt-3">
            <button onClick={() => setStage("review")} className="px-3 py-2 rounded-md text-sm" style={{ background: COLORS.bg, color: COLORS.muted }}>Back</button>
            <button
              disabled={!comment.trim() || requestChanges.isPending}
              onClick={() => requestChanges.mutate({ id: task.id, comment: comment.trim() }, { onSuccess: onClose, onError: (e) => setError(apiErrorMessage(e)) })}
              className="flex-1 py-2 rounded-md text-sm font-semibold text-white disabled:opacity-40" style={{ background: "#FF9800" }}>
              Send Back to In Progress
            </button>
          </div>
        </>
      )}

      {stage === "followUp" && (
        <>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 size={20} style={{ color: "#4CAF50" }} />
            <span className="font-bold text-sm">Approved!</span>
          </div>
          <p className="text-sm mb-4" style={{ color: COLORS.muted }}>
            Would you like to create a follow-up task linked to this one, or a new independent task?
          </p>
          <div className="space-y-2">
            <button onClick={() => { onClose(); openCreate(task.id); }} className="w-full flex items-center gap-2 py-2.5 px-3 rounded-md text-sm font-semibold text-white" style={{ background: COLORS.primary }}>
              <CornerDownRight size={16} /> Create Follow-up Task
            </button>
            <button onClick={() => { onClose(); openCreate(null); }} className="w-full flex items-center gap-2 py-2.5 px-3 rounded-md text-sm font-semibold" style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}` }}>
              <Plus size={16} /> Create New Task
            </button>
            <button onClick={onClose} className="w-full py-2 rounded-md text-sm" style={{ color: COLORS.muted }}>Skip</button>
          </div>
        </>
      )}
    </Modal>
  );
}
