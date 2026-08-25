import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Loader2, RefreshCw, Upload, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { summarizeNotes } from "@/lib/ai.functions";
import type { SummaryResult } from "@/lib/ai-types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/CopyButton";

export const Route = createFileRoute("/notes")({
  head: () => ({
    meta: [
      { title: "Meeting Notes Summarizer — FlowDesk" },
      {
        name: "description",
        content:
          "Paste or upload a transcript and get key points, decisions, action items and deadlines in seconds.",
      },
      { property: "og:title", content: "Meeting Notes Summarizer — FlowDesk" },
      {
        property: "og:description",
        content: "Turn messy meeting notes into decisions, action items and deadlines.",
      },
    ],
  }),
  component: NotesPage,
});

function toMarkdown(s: SummaryResult) {
  const lines = [
    `# ${s.title}`,
    "",
    s.overview,
    "",
    "## Key points",
    ...s.keyPoints.map((p) => `- ${p}`),
    "",
    "## Decisions",
    ...(s.decisions.length ? s.decisions.map((d) => `- ${d}`) : ["- None recorded"]),
    "",
    "## Action items",
    ...(s.actionItems.length
      ? s.actionItems.map((a) => `- ${a.task} — ${a.owner} (${a.deadline})`)
      : ["- None recorded"]),
    "",
    "## Topics",
    ...s.topics.map((t) => `- ${t}`),
    "",
    "## Open questions",
    ...(s.openQuestions.length ? s.openQuestions.map((q) => `- ${q}`) : ["- None"]),
  ];
  return lines.join("\n");
}

function NotesPage() {
  const summarizeFn = useServerFn(summarizeNotes);
  const fileRef = useRef<HTMLInputElement>(null);
  const [notes, setNotes] = useState("");
  const [summary, setSummary] = useState<SummaryResult | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const summarize = useMutation({
    mutationFn: () => summarizeFn({ data: { notes } }),
    onSuccess: (result) => {
      setSummary(result);
      setEditing(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Badge variant="secondary" className="gap-1">
          <FileText className="size-3" /> Meeting intelligence
        </Badge>
        <h1 className="text-3xl font-semibold sm:text-4xl">Meeting Notes Summarizer</h1>
        <p className="max-w-2xl text-muted-foreground">
          Paste raw notes or upload a transcript. Get a structured briefing with decisions, owners
          and deadlines.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <form
          className="surface-card h-fit space-y-4 p-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (notes.trim().length < 30) {
              toast.error("Paste at least a few sentences of notes");
              return;
            }
            summarize.mutate();
          }}
        >
          <div className="flex items-center justify-between">
            <Label htmlFor="notes">Notes or transcript</Label>
            <Button type="button" variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" /> Upload .txt
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.md,.vtt,.srt,text/plain"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setNotes(await file.text());
                toast.success(`Loaded ${file.name}`);
                event.target.value = "";
              }}
            />
          </div>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={18}
            placeholder="10:02 Ana: we agreed to ship the beta on the 12th…"
          />
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{notes.trim() ? `${notes.trim().split(/\s+/).length} words` : "Empty"}</span>
            {notes && (
              <button type="button" className="underline" onClick={() => setNotes("")}>
                Clear
              </button>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={summarize.isPending}>
            {summarize.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Summarizing…
              </>
            ) : (
              <>
                <Wand2 className="size-4" /> {summary ? "Regenerate summary" : "Summarize meeting"}
              </>
            )}
          </Button>
        </form>

        <section className="surface-card min-h-[420px] p-5">
          {summarize.isPending ? (
            <div className="space-y-3">
              <div className="h-6 w-1/2 animate-pulse rounded bg-muted" />
              <div className="h-20 w-full animate-pulse rounded bg-muted" />
              <div className="h-40 w-full animate-pulse rounded bg-muted" />
            </div>
          ) : !summary ? (
            <div className="flex h-full min-h-[360px] flex-col items-center justify-center gap-3 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-muted">
                <FileText className="size-5 text-muted-foreground" />
              </span>
              <p className="font-display text-lg font-semibold">No summary yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Drop in your meeting notes and FlowDesk will pull out the decisions and action items.
              </p>
            </div>
          ) : editing ? (
            <div className="space-y-3">
              <Label htmlFor="draft">Edit summary</Label>
              <Textarea
                id="draft"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={22}
                className="font-mono text-sm"
              />
              <div className="flex gap-2">
                <CopyButton value={draft} />
                <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold">{summary.title}</h2>
                  <p className="mt-1 max-w-2xl text-muted-foreground">{summary.overview}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <CopyButton value={toMarkdown(summary)} />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDraft(toMarkdown(summary));
                      setEditing(true);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => summarize.mutate()}
                    disabled={summarize.isPending}
                  >
                    <RefreshCw className="size-4" /> Regenerate
                  </Button>
                </div>
              </div>

              <Section title="Key discussion points" items={summary.keyPoints} />
              <Section title="Decisions" items={summary.decisions} />

              <div>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Action items
                </h3>
                {summary.actionItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">None captured.</p>
                ) : (
                  <ul className="space-y-2">
                    {summary.actionItems.map((a, i) => (
                      <li
                        key={i}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2"
                      >
                        <span className="text-sm">{a.task}</span>
                        <span className="flex gap-2">
                          <Badge variant="secondary">{a.owner}</Badge>
                          <Badge variant="outline">{a.deadline}</Badge>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {summary.topics.map((t) => (
                  <Badge key={t} variant="outline">
                    {t}
                  </Badge>
                ))}
              </div>

              <Section title="Open questions" items={summary.openQuestions} />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">None captured.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item, i) => (
            <li key={i} className="flex gap-2 text-sm">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
