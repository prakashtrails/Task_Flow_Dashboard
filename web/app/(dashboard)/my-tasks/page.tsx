"use client";

import { useTasks } from "@/hooks/useApi";
import { useAuthStore } from "@/lib/store/authStore";
import { TaskArea } from "@/components/TaskArea";

export default function MyTasksPage() {
  const user = useAuthStore((s) => s.user);
  const { data, isLoading } = useTasks({ mine: true });
  return (
    <TaskArea
      title="My Tasks"
      subtitle={user ? `Tasks involving ${user.name}` : ""}
      tasks={data?.data || []}
      loading={isLoading}
    />
  );
}
