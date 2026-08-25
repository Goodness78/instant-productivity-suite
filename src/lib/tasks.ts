import { useCallback, useEffect, useState } from "react";

export type Priority = "high" | "medium" | "low";
export type Status = "todo" | "in_progress" | "done";

export type Step = { id: string; text: string; done: boolean };

export type Task = {
  id: string;
  title: string;
  notes: string;
  priority: Priority;
  estimatedMinutes: number;
  dueDate: string; // YYYY-MM-DD
  status: Status;
  steps: Step[];
  createdAt: number;
};

const KEY = "flowdesk.tasks.v1";

export const uid = () => Math.random().toString(36).slice(2, 10);

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysISO(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function formatDay(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function load(): Task[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Task[]) : [];
  } catch {
    return [];
  }
}

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setTasks(load());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(KEY, JSON.stringify(tasks));
  }, [tasks, hydrated]);

  const addTasks = useCallback((incoming: Omit<Task, "id" | "createdAt" | "status">[]) => {
    setTasks((prev) => [
      ...prev,
      ...incoming.map((t) => ({ ...t, id: uid(), createdAt: Date.now(), status: "todo" as Status })),
    ]);
  }, []);

  const updateTask = useCallback((id: string, patch: Partial<Task>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const removeTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearDone = useCallback(() => {
    setTasks((prev) => prev.filter((t) => t.status !== "done"));
  }, []);

  return { tasks, hydrated, addTasks, updateTask, removeTask, clearDone, setTasks };
}

const priorityWeight: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

export function sortTasks(tasks: Task[]) {
  return [...tasks].sort((a, b) => {
    if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
    if (a.priority !== b.priority) return priorityWeight[a.priority] - priorityWeight[b.priority];
    return a.createdAt - b.createdAt;
  });
}

export type Block = { task: Task; start: string; end: string };
export type DaySchedule = { date: string; blocks: Block[]; overflowMinutes: number };

const DAY_START = 9 * 60;
const DAY_END = 17 * 60;
const CAPACITY = DAY_END - DAY_START;

function toClock(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/**
 * Greedy scheduler: walks days forward from today, packing the highest priority
 * / soonest-due open tasks into 9am-5pm blocks. Re-runs on every task change,
 * so the schedule reorganizes automatically.
 */
export function buildSchedule(tasks: Task[], days: number, startDate = todayISO()): DaySchedule[] {
  const queue = sortTasks(tasks.filter((t) => t.status !== "done"));
  const schedule: DaySchedule[] = [];
  let index = 0;

  for (let d = 0; d < days; d++) {
    const date = addDaysISO(startDate, d);
    let cursor = DAY_START;
    const blocks: Block[] = [];

    while (index < queue.length) {
      const task = queue[index]!;
      const duration = Math.min(Math.max(task.estimatedMinutes || 30, 15), CAPACITY);
      if (cursor + duration > DAY_END) break;
      blocks.push({ task, start: toClock(cursor), end: toClock(cursor + duration) });
      cursor += duration + 15;
      index++;
    }

    schedule.push({ date, blocks, overflowMinutes: 0 });
  }

  const remaining = queue.slice(index).reduce((sum, t) => sum + (t.estimatedMinutes || 30), 0);
  if (schedule.length > 0) schedule[schedule.length - 1]!.overflowMinutes = remaining;
  return schedule;
}
