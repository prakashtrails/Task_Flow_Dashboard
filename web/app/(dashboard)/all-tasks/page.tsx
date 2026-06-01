"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTasks } from "@/hooks/useApi";
import { useAuthStore } from "@/lib/store/authStore";
import { TaskArea } from "@/components/TaskArea";

export default function AllTasksPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { data, isLoading } = useTasks({});

  useEffect(() => {
    if (user && user.role !== "Assigner") router.replace("/my-tasks");
  }, [user, router]);

  if (user && user.role !== "Assigner") return null;

  return (
    <TaskArea
      title="All Tasks"
      subtitle="Every task across the team"
      tasks={data?.data || []}
      loading={isLoading}
    />
  );
}
