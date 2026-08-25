import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  generateEmailCore,
  transformEmailCore,
  summarizeNotesCore,
  planTasksCore,
} from "./ai-core.server";

export const generateEmail = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        instruction: z.string().min(1),
        tone: z.string(),
        recipient: z.string().optional(),
        context: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => generateEmailCore(data));

export const transformEmail = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        body: z.string().min(1),
        action: z.string(),
        tone: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => transformEmailCore(data));

export const summarizeNotes = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ notes: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => summarizeNotesCore(data));

export const planTasks = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ request: z.string().min(1), today: z.string() }).parse(input),
  )
  .handler(async ({ data }) => planTasksCore(data));
