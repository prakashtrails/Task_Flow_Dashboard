"use client";

import { Trash2 } from "lucide-react";
import { useNotifications, useMarkRead, useClearNotifications } from "@/hooks/useApi";
import { useAuthStore } from "@/lib/store/authStore";
import { useUiStore } from "@/lib/store/uiStore";
import { COLORS } from "@/lib/theme";
import { relativeTime } from "@/lib/utils";
import { Avatar } from "@/components/ui";

export default function FeedPage() {
  const user = useAuthStore((s) => s.user);
  const { data: notifications } = useNotifications();
  const markRead = useMarkRead();
  const clearAll = useClearNotifications();
  const selectTask = useUiStore((s) => s.selectTask);

  const list = notifications || [];

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-wide">Activity Feed</h1>
          <p className="text-sm" style={{ color: COLORS.muted }}>Notifications for {user?.name}</p>
        </div>
        <button onClick={() => clearAll.mutate()} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md"
          style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, color: COLORS.muted }}>
          <Trash2 size={14} /> Clear all
        </button>
      </div>

      <div className="space-y-2">
        {list.length === 0 && (
          <div className="rounded-lg p-8 text-center text-sm" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, color: COLORS.muted }}>
            No notifications.
          </div>
        )}
        {list.map((n) => (
          <div key={n.id} onClick={() => markRead.mutate(n.id)} className="flex items-start gap-3 p-3 rounded-lg cursor-pointer"
            style={{ background: n.is_read ? COLORS.surface : COLORS.elevated, border: `1px solid ${n.is_read ? COLORS.border : COLORS.primary + "55"}` }}>
            {n.actor && <Avatar user={n.actor} size={32} />}
            <div className="flex-1 min-w-0">
              <div className="text-sm">{n.message}</div>
              {n.task_id && (
                <button onClick={(e) => { e.stopPropagation(); selectTask(n.task_id!); markRead.mutate(n.id); }}
                  className="text-xs mt-0.5 hover:underline" style={{ color: COLORS.primary }}>
                  {n.task_title} →
                </button>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-[10px] font-mono" style={{ color: COLORS.muted }}>{relativeTime(n.created_at)}</span>
              {!n.is_read && <span className="w-2 h-2 rounded-full" style={{ background: COLORS.primary }} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
