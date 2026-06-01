import { api } from "./axios";
import type {
  DashboardMetrics,
  Notification,
  Page,
  Status,
  TaskDetail,
  TaskSummary,
  User,
  WorkloadEntry,
} from "../types";

/* ---------------- auth ---------------- */
export async function login(email: string, password: string) {
  const { data } = await api.post("/auth/login", { email, password });
  return data as { access_token: string; refresh_token: string };
}

export async function fetchMe() {
  const { data } = await api.get("/auth/me");
  return data as User;
}

/* ---------------- users ---------------- */
export async function fetchUsers() {
  const { data } = await api.get("/users");
  return data as User[];
}

/* ---------------- tasks ---------------- */
export interface TaskFilters {
  status?: Status;
  priority?: string;
  assignee_id?: string;
  mine?: boolean;
  q?: string;
  sort_by?: string;
  sort_dir?: "asc" | "desc";
  per_page?: number;
  page?: number;
}

export async function fetchTasks(filters: TaskFilters = {}) {
  const params = { per_page: 100, ...filters };
  const { data } = await api.get("/tasks", { params });
  return data as Page<TaskSummary>;
}

export async function fetchTask(id: string) {
  const { data } = await api.get(`/tasks/${id}`);
  return data as TaskDetail;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority: string;
  assignee_id: string;
  due_date: string;
  estimated_effort?: number;
  effort_unit?: string;
  tags?: string[];
  depends_on_task_ids?: string[];
  parent_task_id?: string | null;
}

export async function createTask(input: CreateTaskInput) {
  const { data } = await api.post("/tasks", input);
  return data as TaskDetail;
}

export async function transitionStatus(id: string, status: Status) {
  const { data } = await api.post(`/tasks/${id}/status`, { status });
  return data as TaskDetail;
}

export async function approveTask(id: string, comment?: string) {
  const { data } = await api.post(`/tasks/${id}/approve`, { comment });
  return data as TaskDetail;
}

export async function requestChanges(id: string, comment: string) {
  const { data } = await api.post(`/tasks/${id}/request-changes`, { comment });
  return data as TaskDetail;
}

export async function postProgressUpdate(
  id: string,
  current_work: string,
  next_steps: string
) {
  const { data } = await api.post(`/tasks/${id}/updates`, {
    current_work,
    next_steps,
  });
  return data;
}

export async function addSubtask(
  taskId: string,
  body: { title: string; assignee_id: string; due_date: string }
) {
  const { data } = await api.post(`/tasks/${taskId}/subtasks`, body);
  return data as TaskSummary;
}

export async function updateSubtask(
  taskId: string,
  subId: string,
  status: string
) {
  const { data } = await api.patch(`/tasks/${taskId}/subtasks/${subId}`, {
    status,
  });
  return data as TaskSummary;
}

export async function fetchSubtasks(taskId: string) {
  const { data } = await api.get(`/tasks/${taskId}/subtasks`);
  return data as TaskSummary[];
}

/* ---------------- metrics ---------------- */
export async function fetchDashboard() {
  const { data } = await api.get("/metrics/dashboard");
  return data as DashboardMetrics;
}

export async function fetchTeamWorkload() {
  const { data } = await api.get("/metrics/team-workload");
  return data.workload as WorkloadEntry[];
}

/* ---------------- notifications ---------------- */
export async function fetchNotifications(unread = false) {
  const { data } = await api.get("/notifications", { params: { unread } });
  return data as Notification[];
}

export async function markNotificationRead(id: string) {
  await api.patch(`/notifications/${id}/read`);
}

export async function clearNotifications() {
  await api.delete("/notifications");
}
