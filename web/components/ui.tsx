"use client";

import type { User } from "@/lib/types";
import { COLORS, PRIORITY_COLORS, STATUS_COLORS } from "@/lib/theme";

export function Avatar({ user, size = 32 }: { user?: User | null; size?: number }) {
  if (!user) return null;
  return (
    <div
      title={`${user.name} · ${user.role}`}
      style={{
        width: size,
        height: size,
        background: user.avatar_color,
        fontSize: size * 0.4,
      }}
      className="rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 select-none"
    >
      {user.avatar}
    </div>
  );
}

export function Badge({
  label,
  color,
  subtle = false,
}: {
  label: string;
  color: string;
  subtle?: boolean;
}) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold whitespace-nowrap"
      style={{
        color: subtle ? color : "#fff",
        background: subtle ? color + "22" : color,
        border: subtle ? `1px solid ${color}55` : "none",
      }}
    >
      {label}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  return <Badge label={priority} color={PRIORITY_COLORS[priority as keyof typeof PRIORITY_COLORS]} subtle />;
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge label={status} color={STATUS_COLORS[status] || COLORS.muted} />;
}

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rounded-xl shadow-2xl w-full overflow-y-auto"
        style={{
          background: COLORS.elevated,
          border: `1px solid ${COLORS.border}`,
          maxWidth: wide ? 480 : 380,
          maxHeight: "90vh",
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-3 sticky top-0 z-10"
          style={{ background: COLORS.elevated, borderBottom: `1px solid ${COLORS.border}` }}
        >
          <h2 className="font-bold">{title}</h2>
          <button onClick={onClose} className="text-muted">
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export const inputStyle = { background: COLORS.bg, border: `1px solid ${COLORS.border}`, color: COLORS.text };
export const inputCls = "w-full px-3 py-2 rounded-md text-sm outline-none";
