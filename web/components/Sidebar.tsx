"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  ListChecks,
  CheckSquare,
  GitBranch,
  Bell,
  Plus,
  LogOut,
  Sparkles,
} from "lucide-react";
import { useAuthStore } from "@/lib/store/authStore";
import { useUiStore } from "@/lib/store/uiStore";
import { useNotifications } from "@/hooks/useApi";
import { COLORS } from "@/lib/theme";
import { Avatar, Badge } from "./ui";

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);
  const openCreate = useUiStore((s) => s.openCreate);
  const { data: notifications } = useNotifications();

  if (!user) return null;
  const isAssigner = user.role === "Assigner";
  const unread = (notifications || []).filter((n) => !n.is_read).length;

  const links = [
    { href: "/overview", label: "Dashboard", icon: Home },
    { href: "/my-tasks", label: "My Tasks", icon: ListChecks },
    ...(isAssigner ? [{ href: "/all-tasks", label: "All Tasks", icon: CheckSquare }] : []),
    { href: "/queue", label: "Queue View", icon: GitBranch },
    { href: "/feed", label: "Activity Feed", icon: Bell, badge: unread },
    { href: "/assistant", label: "Chat → Task", icon: Sparkles },
  ];

  const logout = () => {
    clear();
    router.replace("/login");
  };

  return (
    <aside
      className="w-[240px] flex-shrink-0 flex flex-col p-4 h-screen sticky top-0"
      style={{ background: COLORS.surface, borderRight: `1px solid ${COLORS.border}` }}
    >
      <div className="flex items-center gap-2 mb-5 px-1">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: COLORS.primary }}
        >
          <ListChecks size={18} className="text-white" />
        </div>
        <span className="font-bold tracking-wide">TaskFlow</span>
      </div>

      <div
        className="flex items-center gap-3 p-2 rounded-lg mb-2"
        style={{ background: COLORS.elevated }}
      >
        <Avatar user={user} size={38} />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm truncate">{user.name}</div>
          <Badge
            label={user.role}
            color={isAssigner ? COLORS.primary : "#43BFA0"}
            subtle
          />
        </div>
      </div>

      <nav className="mt-3 space-y-1 flex-1">
        {links.map((l) => {
          const Icon = l.icon;
          const active = pathname === l.href;
          return (
            <button
              key={l.href}
              onClick={() => router.push(l.href)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: active ? COLORS.primary + "22" : "transparent",
                color: active ? COLORS.primary : COLORS.muted,
              }}
            >
              <Icon size={18} />
              <span className="flex-1 text-left">{l.label}</span>
              {!!l.badge && l.badge > 0 && (
                <span
                  className="notif-pulse text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center text-white"
                  style={{ background: COLORS.danger }}
                >
                  {l.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {isAssigner && (
        <button
          onClick={() => openCreate(null)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-sm text-white transition-transform hover:-translate-y-0.5 mb-2"
          style={{ background: COLORS.primary }}
        >
          <Plus size={18} /> New Task
        </button>
      )}
      <button
        onClick={logout}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm text-muted"
        style={{ border: `1px solid ${COLORS.border}` }}
      >
        <LogOut size={16} /> Sign out
      </button>
    </aside>
  );
}
