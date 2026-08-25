import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarCheck, Clock, Loader2, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { planTasks } from "@/lib/ai.functions";
import {
  buildSchedule,
  formatDay,
  sortTasks,
  todayISO,
  uid,
  useTasks,
  type Priority,
  type Status,
  type Task,
} from "@/lib/tasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/tasks")({
  head: () => ({
    meta: [
      { title: "AI Task Planner & Schedule — FlowDesk" },
      {
        name: "description",
        content:
          "Describe your week in plain language. Get prioritized tasks, actionable steps and an auto-balancing daily and weekly schedule.",
      },
      { property: "og:title", content: "AI Task Planner & Schedule — FlowDesk" },
      {
        property: "og:description",
        content: "Prioritized tasks, steps and time blocks that reorganize themselves.",
      },
    ],
  }),
  component: PlannerPage,
});

const priorityStyles: Record<Priority, string> = {
  high: "bg-destructive/10 text-destructive border-destructive/30",
  medium: "bg-warning/15 text-warning-foreground border-warning/40",
  low: "bg-success/10 text-success border-success/30",
};

function PlannerPage() {
  const planFn = useServerFn(planTasks);
  const { tasks, hydrated, addTasks, updateTask, removeTask, clearDone } = useTasks();
  const [request, setRequest] = useState("");

  const plan = useMutation({
    mutationFn: () => planFn({ data: { request, today: todayISO() } }),
    onSuccess: (result) => {
      addTasks(
        result.tasks.map((t) => ({
          title: t.title,
          notes: t.notes,
          priority: t.priority,
          estimatedMinutes: Math.max(15, Math.round(t.estimatedMinutes || 30)),
          dueDate: /^\d{4}-\d{2}-\d{2}$/.test(t.dueDate) ? t.dueDate : todayISO(),
          steps: t.steps.map((s) => ({ id: uid(), text: s, done: false })),
        })),
      );
      setRequest("");
      toast.success(`Added ${result.tasks.length} task${result.tasks.length === 1 ? "" : "s"}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const ordered = useMemo(() => sortTasks(tasks), [tasks]);
  const daily = useMemo(() => buildSchedule(tasks, 1), [tasks]);
  const weekly = useMemo(() => buildSchedule(tasks, 7), [tasks]);
  const openCount = tasks.filter((t) => t.status !== "done").length;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Badge variant="secondary" className="gap-1">
          <CalendarCheck className="size-3" /> Planning
        </Badge>
        <h1 className="text-3xl font-semibold sm:text-4xl">AI Task Planner &amp; Schedule</h1>
        <p className="max-w-2xl text-muted-foreground">
          Describe your workload in plain language. FlowDesk breaks it into steps, prioritizes it and
          rebuilds your time blocks whenever anything changes.
        </p>
      </header>

      <form
        className="surface-card space-y-3 p-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (!request.trim()) {
            toast.error("Describe what you need to get done");
            return;
          }
          plan.mutate();
        }}
      >
        <Label htmlFor="request">What do you need to get done?</Label>
        <Textarea
          id="request"
          rows={3}
          value={request}
          onChange={(e) => setRequest(e.target.value)}
          placeholder="Launch the Q3 newsletter by Thursday, prep the board deck, and interview two candidates this week."
        />
        <Button type="submit" disabled={plan.isPending}>
          {plan.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Planning…
            </>
          ) : (
            <>
              <Wand2 className="size-4" /> Plan with AI
            </>
          )}
        </Button>
      </form>

      <Tabs defaultValue="tasks">
        <TabsList>
          <TabsTrigger value="tasks">Tasks ({openCount})</TabsTrigger>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="week">This week</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="mt-4 space-y-3">
          {!hydrated ? (
            <div className="h-32 w-full animate-pulse rounded-xl bg-muted" />
          ) : ordered.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              {ordered.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onUpdate={(patch) => updateTask(task.id, patch)}
                  onDelete={() => removeTask(task.id)}
                />
              ))}
              {tasks.some((t) => t.status === "done") && (
                <Button variant="ghost" size="sm" onClick={clearDone}>
                  Clear completed
                </Button>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="today" className="mt-4">
          <ScheduleView schedule={daily} hydrated={hydrated} />
        </TabsContent>

        <TabsContent value="week" className="mt-4">
          <ScheduleView schedule={weekly} hydrated={hydrated} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="surface-card flex flex-col items-center justify-center gap-3 p-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-muted">
        <CalendarCheck className="size-5 text-muted-foreground" />
      </span>
      <p className="font-display text-lg font-semibold">No tasks yet</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Describe your week above and FlowDesk will turn it into prioritized tasks with a schedule.
      </p>
    </div>
  );
}

function TaskCard({
  task,
  onUpdate,
  onDelete,
}: {
  task: Task;
  onUpdate: (patch: Partial<Task>) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const done = task.status === "done";

  return (
    <article className={`surface-card p-4 ${done ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <Checkbox
            checked={done}
            className="mt-1"
            aria-label="Complete task"
            onCheckedChange={(checked) => onUpdate({ status: checked ? "done" : "todo" })}
          />
          <div className="min-w-0 space-y-1">
            {editing ? (
              <Input
                value={task.title}
                onChange={(e) => onUpdate({ title: e.target.value })}
                aria-label="Task title"
              />
            ) : (
              <h3 className={`text-base font-semibold ${done ? "line-through" : ""}`}>
                {task.title}
              </h3>
            )}
            {task.notes && <p className="text-sm text-muted-foreground">{task.notes}</p>}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <Badge variant="outline" className={priorityStyles[task.priority]}>
                {task.priority}
              </Badge>
              <span className="flex items-center gap-1 text-muted-foreground">
                <Clock className="size-3" /> {task.estimatedMinutes}m
              </span>
              <span className="text-muted-foreground">Due {formatDay(task.dueDate)}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={task.status}
            onValueChange={(value) => onUpdate({ status: value as Status })}
          >
            <SelectTrigger className="h-8 w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todo">To do</SelectItem>
              <SelectItem value="in_progress">In progress</SelectItem>
              <SelectItem value="done">Done</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={() => setEditing((v) => !v)}>
            {editing ? "Close" : "Edit"}
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} aria-label="Delete task">
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {editing && (
        <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Due date</Label>
            <Input
              type="date"
              value={task.dueDate}
              onChange={(e) => onUpdate({ dueDate: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Priority</Label>
            <Select
              value={task.priority}
              onValueChange={(value) => onUpdate({ priority: value as Priority })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Estimate (minutes)</Label>
            <Input
              type="number"
              min={15}
              step={15}
              value={task.estimatedMinutes}
              onChange={(e) => onUpdate({ estimatedMinutes: Number(e.target.value) || 30 })}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-3">
            <Label className="text-xs">Notes</Label>
            <Textarea
              rows={2}
              value={task.notes}
              onChange={(e) => onUpdate({ notes: e.target.value })}
            />
          </div>
        </div>
      )}

      {task.steps.length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-border pt-3">
          {task.steps.map((step) => (
            <li key={step.id} className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={step.done}
                className="mt-0.5"
                aria-label={step.text}
                onCheckedChange={(checked) =>
                  onUpdate({
                    steps: task.steps.map((s) =>
                      s.id === step.id ? { ...s, done: Boolean(checked) } : s,
                    ),
                  })
                }
              />
              <span className={step.done ? "text-muted-foreground line-through" : ""}>
                {step.text}
              </span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function ScheduleView({
  schedule,
  hydrated,
}: {
  schedule: ReturnType<typeof buildSchedule>;
  hydrated: boolean;
}) {
  if (!hydrated) return <div className="h-32 w-full animate-pulse rounded-xl bg-muted" />;
  const empty = schedule.every((d) => d.blocks.length === 0);
  if (empty) return <EmptyState />;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {schedule.map((day) => (
        <div key={day.date} className="surface-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-base font-semibold">{formatDay(day.date)}</h3>
            <span className="text-xs text-muted-foreground">{day.blocks.length} blocks</span>
          </div>
          {day.blocks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing scheduled — free day.</p>
          ) : (
            <ul className="space-y-2">
              {day.blocks.map((block) => (
                <li
                  key={block.task.id}
                  className="rounded-lg border border-border bg-card px-3 py-2"
                >
                  <p className="text-xs font-medium text-primary">
                    {block.start} – {block.end}
                  </p>
                  <p className="text-sm font-medium">{block.task.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {block.task.priority} priority · due {formatDay(block.task.dueDate)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {day.overflowMinutes > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              {Math.round(day.overflowMinutes / 60)}h of work still unscheduled beyond this range.
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
