"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { TaskDetailPanel } from "@/components/TaskDetailPanel";
import { TaskCreateModal } from "@/components/TaskCreateModal";
import { ApprovalModal } from "@/components/ApprovalModal";
import { useAuthStore, useAuthHydrated } from "@/lib/store/authStore";
import { useUiStore } from "@/lib/store/uiStore";
import { fetchMe } from "@/lib/api/endpoints";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const token = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthHydrated();
  const setUser = useAuthStore((s) => s.setUser);
  const selectedTaskId = useUiStore((s) => s.selectedTaskId);

  useEffect(() => {
    if (!hydrated) return;
    if (!token) {
      router.replace("/login");
      return;
    }
    if (!user) {
      fetchMe().then(setUser).catch(() => {});
    }
  }, [hydrated, token, user, router, setUser]);

  if (!hydrated || !token) {
    return (
      <div className="h-screen flex items-center justify-center text-muted">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen" style={{ background: "#0F1117" }}>
      <Sidebar />
      <main
        className="flex-1 p-6 overflow-x-hidden"
        style={{
          marginRight: selectedTaskId ? 380 : 0,
          transition: "margin 200ms ease",
        }}
      >
        {children}
      </main>
      <TaskDetailPanel />
      <TaskCreateModal />
      <ApprovalModal />
    </div>
  );
}
