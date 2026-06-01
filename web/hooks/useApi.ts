"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import * as ep from "@/lib/api/endpoints";
import type { Status } from "@/lib/types";

const invalidateTaskData = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ["tasks"] });
  qc.invalidateQueries({ queryKey: ["task"] });
  qc.invalidateQueries({ queryKey: ["subtasks"] });
  qc.invalidateQueries({ queryKey: ["metrics"] });
  qc.invalidateQueries({ queryKey: ["notifications"] });
};

export function useTasks(filters: ep.TaskFilters = {}) {
  return useQuery({
    queryKey: ["tasks", filters],
    queryFn: () => ep.fetchTasks(filters),
  });
}

export function useTask(id: string | null) {
  return useQuery({
    queryKey: ["task", id],
    queryFn: () => ep.fetchTask(id as string),
    enabled: !!id,
  });
}

export function useUsers(enabled = true) {
  return useQuery({ queryKey: ["users"], queryFn: ep.fetchUsers, enabled });
}

export function useDashboard() {
  return useQuery({ queryKey: ["metrics", "dashboard"], queryFn: ep.fetchDashboard });
}

export function useTeamWorkload(enabled = true) {
  return useQuery({
    queryKey: ["metrics", "workload"],
    queryFn: ep.fetchTeamWorkload,
    enabled,
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => ep.fetchNotifications(false),
    refetchInterval: 20000,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ep.createTask,
    onSuccess: () => invalidateTaskData(qc),
  });
}

export function useTransitionStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Status }) =>
      ep.transitionStatus(id, status),
    onSuccess: () => invalidateTaskData(qc),
  });
}

export function useApproveTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, comment }: { id: string; comment?: string }) =>
      ep.approveTask(id, comment),
    onSuccess: () => invalidateTaskData(qc),
  });
}

export function useRequestChanges() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, comment }: { id: string; comment: string }) =>
      ep.requestChanges(id, comment),
    onSuccess: () => invalidateTaskData(qc),
  });
}

export function usePostUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      current_work,
      next_steps,
    }: {
      id: string;
      current_work: string;
      next_steps: string;
    }) => ep.postProgressUpdate(id, current_work, next_steps),
    onSuccess: () => invalidateTaskData(qc),
  });
}

export function useAddSubtask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      taskId,
      title,
      assignee_id,
      due_date,
    }: {
      taskId: string;
      title: string;
      assignee_id: string;
      due_date: string;
    }) => ep.addSubtask(taskId, { title, assignee_id, due_date }),
    onSuccess: () => invalidateTaskData(qc),
  });
}

export function useUpdateSubtask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      taskId,
      subId,
      status,
    }: {
      taskId: string;
      subId: string;
      status: string;
    }) => ep.updateSubtask(taskId, subId, status),
    onSuccess: () => invalidateTaskData(qc),
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ep.markNotificationRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useClearNotifications() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ep.clearNotifications,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}
