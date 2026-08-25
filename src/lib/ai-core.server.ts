import { streamText } from "ai";
import { z } from "zod";
import { requireGateway, CHAT_MODEL } from "./ai-gateway.server";

function extractJson(raw: string) {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? raw).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("The AI returned an unexpected response.");
  return JSON.parse(candidate.slice(start, end + 1));
}

async function runStructured<T>(opts: {
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
  shape: string;
}): Promise<T> {
  const gateway = requireGateway();
  try {
    const result = streamText({
      model: gateway(CHAT_MODEL),
      system: `${opts.system}\n\nRespond with ONLY a valid JSON object matching this shape (no commentary, no markdown fences):\n${opts.shape}`,
      prompt: opts.prompt,
    });
    const text = await result.text;
    return opts.schema.parse(extractJson(text));
  } catch (error) {
    throw new Error(readableError(error));
  }
}

function readableError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("402")) return "AI credits are exhausted. Add credits to keep generating.";
  if (message.includes("429")) return "Too many requests right now. Please wait a moment and retry.";
  if (message.includes("401") || message.includes("403"))
    return "AI access is blocked for this workspace.";
  return message || "The AI request failed. Please try again.";
}

export const emailSchema = z.object({
  subjects: z.array(z.string()),
  body: z.string(),
});
export type EmailResult = z.infer<typeof emailSchema>;

export function generateEmailCore(input: {
  instruction: string;
  tone: string;
  recipient?: string | undefined;
  context?: string | undefined;
}) {
  return runStructured({
    schema: emailSchema,
    shape: '{ "subjects": ["string", "string", "string"], "body": "string" }',
    system:
      "You are an expert business writer. Write ready-to-send emails. Return 3 distinct subject line suggestions and a complete email body with greeting and sign-off. Use plain text, no markdown headings.",
    prompt: [
      `Tone: ${input.tone}`,
      input.recipient ? `Recipient: ${input.recipient}` : "",
      input.context ? `Extra context: ${input.context}` : "",
      `Instruction: ${input.instruction}`,
    ]
      .filter(Boolean)
      .join("\n"),
  });
}

export function transformEmailCore(input: {
  body: string;
  action: string;
  tone?: string | undefined;
}) {
  const instructions: Record<string, string> = {
    shorten: "Make this email significantly shorter while keeping all essential information.",
    expand: "Expand this email with helpful detail and context, staying natural.",
    simplify: "Rewrite this email in simple, plain language anyone can understand.",
    tone: `Rewrite this email in a ${input.tone ?? "professional"} tone.`,
    polish: "Polish grammar, clarity and flow without changing the meaning.",
  };
  return runStructured({
    schema: emailSchema,
    shape: '{ "subjects": ["string", "string", "string"], "body": "string" }',
    system:
      "You rewrite emails. Return 3 subject line suggestions and the rewritten email body in plain text.",
    prompt: `${instructions[input.action] ?? instructions['polish']}\n\nEmail:\n${input.body}`,
  });
}

export const summarySchema = z.object({
  title: z.string(),
  overview: z.string(),
  keyPoints: z.array(z.string()),
  decisions: z.array(z.string()),
  actionItems: z.array(
    z.object({
      task: z.string(),
      owner: z.string(),
      deadline: z.string(),
    }),
  ),
  topics: z.array(z.string()),
  openQuestions: z.array(z.string()),
});
export type SummaryResult = z.infer<typeof summarySchema>;

export function summarizeNotesCore(input: { notes: string }) {
  return runStructured({
    schema: summarySchema,
    shape:
      '{ "title": "string", "overview": "string", "keyPoints": ["string"], "decisions": ["string"], "actionItems": [{ "task": "string", "owner": "string", "deadline": "string" }], "topics": ["string"], "openQuestions": ["string"] }',
    system:
      "You summarize meeting notes and transcripts into a crisp structured briefing. Use 'Unassigned' when an owner is unknown and 'No deadline' when no date is mentioned. Never invent facts.",
    prompt: `Summarize these meeting notes:\n\n${input.notes}`,
  });
}

export const planSchema = z.object({
  tasks: z.array(
    z.object({
      title: z.string(),
      notes: z.string(),
      priority: z.enum(["high", "medium", "low"]),
      estimatedMinutes: z.number(),
      dueDate: z.string(),
      steps: z.array(z.string()),
    }),
  ),
});
export type PlanResult = z.infer<typeof planSchema>;

export function planTasksCore(input: { request: string; today: string }) {
  return runStructured({
    schema: planSchema,
    shape:
      '{ "tasks": [{ "title": "string", "notes": "string", "priority": "high|medium|low", "estimatedMinutes": 60, "dueDate": "YYYY-MM-DD", "steps": ["string"] }] }',
    system:
      "You are a pragmatic planning assistant. Break the user's request into concrete tasks, each with 2-6 actionable steps, a realistic duration in minutes, a priority based on urgency and importance, and a due date in YYYY-MM-DD format. Never schedule anything before today.",
    prompt: `Today is ${input.today}.\n\nRequest:\n${input.request}`,
  });
}
