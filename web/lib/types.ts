export type Role = "Assigner" | "Assignee";
export type Priority = "Low" | "Medium" | "High" | "Critical";
export type Status =
  | "Queued"
  | "In Progress"
  | "Pending Review"
  | "Approved"
  | "Closed";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar: string;
  avatar_color: string;
  timezone?: string;
}

export interface Tag {
  name: string;
  color: string;
}

export interface Tat {
  tat_hours: number;
  tat_label: string;
  is_overdue: boolean;
  is_due_soon: boolean;
  tat_status: "overdue" | "due_soon" | "on_track";
}

export interface ProgressUpdate {
  id: string;
  task_id: string;
  user_id: string;
  current_work: string;
  next_steps: string;
  created_at: string;
}

export interface ApprovalEvent {
  id: string;
  task_id: string;
  user_id: string;
  action: "Approved" | "Changes Requested";
  comment: string | null;
  created_at: string;
}

export interface TaskSummary {
  id: string;
  title: string;
  description: string | null;
  priority: Priority;
  status: Status;
  assigner: User;
  assignee: User;
  due_date: string;
  estimated_effort: number | null;
  effort_unit: "hours" | "points" | null;
  is_blocked: boolean;
  parent_task_id: string | null;
  created_at: string;
  approved_at: string | null;
  tags: Tag[];
  depends_on_task_ids: string[];
  tat: Tat;
  subtask_count: number;
  subtask_done_count: number;
}

export interface TaskDetail extends TaskSummary {
  started_at: string | null;
  submitted_at: string | null;
  closed_at: string | null;
  progress_updates: ProgressUpdate[];
  approval_events: ApprovalEvent[];
  blocking_titles: string[];
}

export interface Notification {
  id: string;
  type: string;
  actor: User | null;
  task_id: string | null;
  task_title: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface DashboardMetrics {
  status_distribution: { status: Status; count: number }[];
  overdue_count: number;
  avg_tat_hours: number | null;
  total_tasks: number;
}

export interface WorkloadEntry {
  user: User;
  in_progress: number;
  queued: number;
  overdue: number;
}

export interface Page<T> {
  data: T[];
  meta: { page: number; per_page: number; total: number };
}
