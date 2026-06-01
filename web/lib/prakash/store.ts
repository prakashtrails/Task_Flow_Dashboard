// Prakash-style Chat→Task module — per-user localStorage persistence.
// Every function takes `ns` (the user's email) so each teammate's chat tasks
// and learned rules stay separate on a shared browser.
import type { Category, Priority } from "./constants";

const rulesKey = (ns: string) => `curlo-learned-rules:${ns}`;
const tasksKey = (ns: string) => `curlo-tasks:${ns}`;

export interface LearnedRule {
  id: string;
  field: "category" | "priority";
  triggerWords: string[];
  correctedTo: string;
  fromVal: string;
  appliedCount: number;
  example: string;
  ts: number;
}

export interface PrakashTask {
  id: string; // id of the task created on the main board (API)
  title: string;
  assignee: string;
  category: Category;
  priority: Priority;
  dueLabel: string | null;
  notes: string | null;
  corrected: boolean;
  done: boolean;
  ts: number;
}

function read<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, value: T[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota errors */
  }
}

function uid(): string {
  return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/* ------------------------------- rules ----------------------------------- */
export function getRules(ns: string): LearnedRule[] {
  return read<LearnedRule>(rulesKey(ns));
}

export function saveRules(ns: string, rules: LearnedRule[]): void {
  write(rulesKey(ns), rules);
}

export function addRule(
  ns: string,
  rule: Omit<LearnedRule, "id" | "appliedCount" | "ts">
): LearnedRule {
  const rules = getRules(ns);
  const created: LearnedRule = { ...rule, id: uid(), appliedCount: 0, ts: Date.now() };
  rules.push(created);
  saveRules(ns, rules);
  return created;
}

export function deleteRule(ns: string, id: string): void {
  saveRules(ns, getRules(ns).filter((r) => r.id !== id));
}

/** Increment appliedCount for the given rule ids (when rules influence a parse). */
export function bumpApplied(ns: string, ids: (string | null)[]): void {
  const valid = ids.filter(Boolean) as string[];
  if (!valid.length) return;
  const rules = getRules(ns);
  let changed = false;
  for (const r of rules) {
    if (valid.includes(r.id)) {
      r.appliedCount += 1;
      changed = true;
    }
  }
  if (changed) saveRules(ns, rules);
}

/* ------------------------------- tasks ----------------------------------- */
export function getTasks(ns: string): PrakashTask[] {
  return read<PrakashTask>(tasksKey(ns));
}

export function saveTasks(ns: string, tasks: PrakashTask[]): void {
  write(tasksKey(ns), tasks);
}

export function addTask(ns: string, task: PrakashTask): void {
  const tasks = getTasks(ns);
  tasks.unshift(task);
  saveTasks(ns, tasks);
}

export function updateTask(ns: string, id: string, patch: Partial<PrakashTask>): void {
  saveTasks(ns, getTasks(ns).map((t) => (t.id === id ? { ...t, ...patch } : t)));
}

export function removeTask(ns: string, id: string): void {
  saveTasks(ns, getTasks(ns).filter((t) => t.id !== id));
}
