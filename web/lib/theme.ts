import type { Priority, Status, Tat } from "./types";

export const COLORS = {
  bg: "#0F1117",
  surface: "#1A1D27",
  elevated: "#22263A",
  border: "#2E3350",
  primary: "#6C8EF5",
  text: "#E8EAF6",
  muted: "#7B82A8",
  success: "#4CAF50",
  warning: "#FF9800",
  danger: "#F44336",
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  Low: "#4CAF50",
  Medium: "#FF9800",
  High: "#F44336",
  Critical: "#9C27B0",
};

export const STATUS_COLORS: Record<string, string> = {
  Queued: "#607D8B",
  "In Progress": "#2196F3",
  "Pending Review": "#FF9800",
  Approved: "#4CAF50",
  Closed: "#9E9E9E",
  Done: "#4CAF50",
};

export const STATUSES: Status[] = [
  "Queued",
  "In Progress",
  "Pending Review",
  "Approved",
  "Closed",
];

export const PRIORITIES: Priority[] = ["Low", "Medium", "High", "Critical"];

export function tatColor(tat: Tat): string {
  if (tat.is_overdue) return COLORS.danger;
  if (tat.is_due_soon) return COLORS.warning;
  return COLORS.success;
}
