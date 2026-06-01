"use client";

import { useMemo, useState } from "react";
import { COLORS } from "@/lib/theme";
import { useAuthStore } from "@/lib/store/authStore";
import { useUsers } from "@/hooks/useApi";
import { ALL_MEMBERS, TeamMember } from "@/lib/prakash/constants";
import { ChatTab } from "@/components/prakash/ChatTab";
import { TasksTab } from "@/components/prakash/TasksTab";
import { LearnedTab } from "@/components/prakash/LearnedTab";

type Tab = "chat" | "tasks" | "learned";

export default function AssistantPage() {
  const user = useAuthStore((s) => s.user);
  const isAssigner = user?.role === "Assigner";
  // Only Assigners may list all users; Assignees just need their own id.
  const { data: users } = useUsers(!!isAssigner);
  const [tab, setTab] = useState<Tab>("chat");
  const [version, setVersion] = useState(0);

  const usersByName = useMemo(() => {
    const m: Record<string, string> = {};
    if (user) m[user.name] = user.id;
    (users || []).forEach((u) => (m[u.name] = u.id));
    return m;
  }, [users, user]);

  const team = useMemo<TeamMember[]>(() => {
    if (!user) return [];
    const selfMember: TeamMember =
      ALL_MEMBERS.find((m) => m.name === user.name) ?? {
        name: user.name,
        role: user.role,
        color: user.avatar_color,
      };
    return isAssigner
      ? ALL_MEMBERS.filter((m) => m.name !== user.name)
      : [selfMember];
  }, [user, isAssigner]);

  if (!user) return null;

  const bump = () => setVersion((v) => v + 1);

  const tabs: { id: Tab; label: string }[] = [
    { id: "chat", label: "💬 Chat" },
    { id: "tasks", label: "✅ Tasks" },
    { id: "learned", label: "🧠 Learned" },
  ];

  return (
    <div>
      <div className="mb-3">
        <h1 className="text-xl font-bold tracking-wide">{user.name} · Chat → Task</h1>
        <p className="text-sm" style={{ color: COLORS.muted }}>
          {isAssigner
            ? "Type natural-language requests, @mention the team, preview & assign — the parser learns from your edits."
            : "Type natural-language notes to create tasks for yourself — the parser learns from your edits."}
        </p>
      </div>

      <div className="flex gap-1 mb-3" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-4 py-2 text-sm font-semibold -mb-px"
            style={{
              color: tab === t.id ? COLORS.primary : COLORS.muted,
              borderBottom: `2px solid ${tab === t.id ? COLORS.primary : "transparent"}`,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="max-w-2xl">
        {tab === "chat" && (
          <ChatTab
            usersByName={usersByName}
            team={team}
            selfName={user.name}
            selfAssignOnly={!isAssigner}
            userKey={user.email}
            onChanged={bump}
          />
        )}
        {tab === "tasks" && <TasksTab userKey={user.email} version={version} onChanged={bump} />}
        {tab === "learned" && <LearnedTab userKey={user.email} version={version} onChanged={bump} />}
      </div>
    </div>
  );
}
