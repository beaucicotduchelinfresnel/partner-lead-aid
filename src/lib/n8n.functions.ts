import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { LeadResult } from "./n8n";

/**
 * Default endpoint: the n8n PRODUCTION webhook.
 * The workflow must be Active (toggle in the n8n editor) for this URL to respond.
 * Override by setting N8N_WEBHOOK_URL (or VITE_N8N_WEBHOOK_URL) — no code change required.
 */
export const DEFAULT_WEBHOOK_URL =
  "https://gayiti.app.n8n.cloud/webhook/7e14d6cc-1f42-4bf3-b027-5ee040a6c114";

const inputSchema = z.object({
  message: z.string().trim().min(1, "Message cannot be empty").max(4000),
});

function firstObject(value: unknown): LeadResult {
  if (Array.isArray(value)) return firstObject(value[0]);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    // n8n sometimes wraps output in { json: {...} } or { output: {...} }
    if (obj["json"] && typeof obj["json"] === "object") return firstObject(obj["json"]);
    if (obj["output"] && typeof obj["output"] === "object") return firstObject(obj["output"]);
    return obj as LeadResult;
  }
  return {};
}

export const processLead = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<LeadResult> => {
    const url =
      process.env["N8N_WEBHOOK_URL"] ||
      process.env["VITE_N8N_WEBHOOK_URL"] ||
      DEFAULT_WEBHOOK_URL;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: data.message }),
        signal: controller.signal,
      });

      const raw = await response.text();

      if (!response.ok) {
        console.error("[n8n] non-2xx response", response.status, raw.slice(0, 500));
        throw new Error(`Workflow responded with status ${response.status}`);
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        console.error("[n8n] invalid JSON response", raw.slice(0, 500));
        throw new Error("Workflow returned an unreadable response");
      }

      const result = firstObject(parsed);
      if (!result.customer_message && !result.decision) {
        console.error("[n8n] unexpected response shape", raw.slice(0, 500));
        throw new Error("Workflow returned an unexpected response");
      }

      return result;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("The workflow took too long to respond");
      }
      throw error instanceof Error ? error : new Error("Unknown workflow error");
    } finally {
      clearTimeout(timeout);
    }
  });
