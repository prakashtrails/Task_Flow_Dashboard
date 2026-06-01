import { formatDistanceToNow, format, parseISO } from "date-fns";

export function relativeTime(iso: string): string {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return "";
  }
}

export function shortDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "MMM d");
  } catch {
    return "—";
  }
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
