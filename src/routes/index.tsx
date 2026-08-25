import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Mail, RefreshCw, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { generateEmail, transformEmail } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CopyButton } from "@/components/CopyButton";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Smart Email Generator — FlowDesk" },
      {
        name: "description",
        content:
          "Turn a one-line instruction into a polished email with subject line suggestions, tone control and instant rewrites.",
      },
      { property: "og:title", content: "Smart Email Generator — FlowDesk" },
      {
        property: "og:description",
        content: "Turn a one-line instruction into a polished, ready-to-send email.",
      },
    ],
  }),
  component: EmailPage,
});

const TONES = ["Professional", "Friendly", "Concise", "Persuasive", "Formal"];

const REFINEMENTS = [
  { action: "shorten", label: "Shorten" },
  { action: "expand", label: "Expand" },
  { action: "simplify", label: "Simplify" },
  { action: "polish", label: "Polish" },
] as const;

function EmailPage() {
  const generateFn = useServerFn(generateEmail);
  const transformFn = useServerFn(transformEmail);

  const [instruction, setInstruction] = useState("");
  const [recipient, setRecipient] = useState("");
  const [context, setContext] = useState("");
  const [tone, setTone] = useState("Professional");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [body, setBody] = useState("");
  const [activeSubject, setActiveSubject] = useState("");

  const generate = useMutation({
    mutationFn: () =>
      generateFn({ data: { instruction, tone, recipient: recipient || undefined, context: context || undefined } }),
    onSuccess: (result) => {
      setSubjects(result.subjects);
      setActiveSubject(result.subjects[0] ?? "");
      setBody(result.body);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const refine = useMutation({
    mutationFn: (vars: { action: string; tone?: string }) =>
      transformFn({ data: { body, action: vars.action, tone: vars.tone } }),
    onSuccess: (result) => {
      setSubjects(result.subjects);
      setActiveSubject(result.subjects[0] ?? activeSubject);
      setBody(result.body);
      toast.success("Email updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const busy = generate.isPending || refine.isPending;
  const fullEmail = `Subject: ${activeSubject}\n\n${body}`;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Badge variant="secondary" className="gap-1">
          <Sparkles className="size-3" /> AI writing
        </Badge>
        <h1 className="text-3xl font-semibold sm:text-4xl">Smart Email Generator</h1>
        <p className="max-w-2xl text-muted-foreground">
          Describe what you need to say. FlowDesk writes the email, suggests subject lines and
          rewrites it on demand.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <form
          className="surface-card h-fit space-y-4 p-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (!instruction.trim()) {
              toast.error("Tell the AI what the email should say");
              return;
            }
            generate.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="instruction">What should the email say?</Label>
            <Textarea
              id="instruction"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="Ask the design team for feedback on the new onboarding flow by Friday"
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="recipient">Recipient (optional)</Label>
            <Input
              id="recipient"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="Maya, Head of Design"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tone">Tone</Label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger id="tone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TONES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="context">Extra context (optional)</Label>
            <Textarea
              id="context"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="We shipped v2 last week and metrics are up 12%."
              rows={3}
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {generate.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Writing…
              </>
            ) : (
              <>
                <Wand2 className="size-4" /> {body ? "Regenerate email" : "Generate email"}
              </>
            )}
          </Button>
        </form>

        <section className="surface-card min-h-[420px] p-5">
          {!body && !generate.isPending ? (
            <div className="flex h-full min-h-[360px] flex-col items-center justify-center gap-3 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-muted">
                <Mail className="size-5 text-muted-foreground" />
              </span>
              <p className="font-display text-lg font-semibold">Your email will appear here</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Add an instruction on the left and generate a draft you can edit, refine and copy.
              </p>
            </div>
          ) : generate.isPending ? (
            <div className="space-y-3">
              <div className="h-5 w-1/3 animate-pulse rounded bg-muted" />
              <div className="h-24 w-full animate-pulse rounded bg-muted" />
              <div className="h-56 w-full animate-pulse rounded bg-muted" />
            </div>
          ) : (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label>Subject suggestions</Label>
                <div className="flex flex-wrap gap-2">
                  {subjects.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setActiveSubject(s)}
                      className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                        activeSubject === s
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <Input
                  value={activeSubject}
                  onChange={(e) => setActiveSubject(e.target.value)}
                  aria-label="Subject line"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="body">Email body</Label>
                <Textarea
                  id="body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={16}
                  className="font-sans leading-relaxed"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <CopyButton value={fullEmail} label="Copy email" />
                {REFINEMENTS.map((r) => (
                  <Button
                    key={r.action}
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    onClick={() => refine.mutate({ action: r.action })}
                  >
                    {r.label}
                  </Button>
                ))}
                <Select onValueChange={(value) => refine.mutate({ action: "tone", tone: value })}>
                  <SelectTrigger className="h-8 w-[170px]" disabled={busy}>
                    <SelectValue placeholder="Change tone…" />
                  </SelectTrigger>
                  <SelectContent>
                    {TONES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy || !instruction.trim()}
                  onClick={() => generate.mutate()}
                >
                  <RefreshCw className="size-4" /> Regenerate
                </Button>
                {refine.isPending && (
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" /> Rewriting…
                  </span>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
