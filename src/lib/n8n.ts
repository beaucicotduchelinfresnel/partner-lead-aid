/**
 * Shared types + client helper for the Partner Referral workflow.
 *
 * The actual HTTP call to n8n happens in `n8n.functions.ts` (server side) so the
 * browser is never blocked by cross-origin restrictions. The workflow response is
 * passed through untouched — nothing here fabricates or simulates a result.
 */

export type Decision = "QUALIFIED" | "NOT_QUALIFIED" | "NEED_MORE_INFORMATION" | string;

export type EmailPayload = {
  subject?: string;
  body?: string;
};

export type LeadResult = {
  status?: string;
  customer_message?: string;
  sales_email?: EmailPayload;
  partner_email?: EmailPayload;
  decision?: Decision;
  next_action?: string;
};

export const EXAMPLES: { label: string; hint: string; message: string }[] = [
  {
    label: "Qualified lead",
    hint: "Valid referral code",
    message:
      "Hi, I'm Jean Pierre. I'm looking for an insurance quote. My referral code is PARTNER001. My email is jean@example.com.",
  },
  {
    label: "Invalid referral",
    hint: "Unknown partner code",
    message:
      "Hi, I'm Jean Pierre. I'm looking for an insurance quote. My referral code is FAKE999. My email is jean@example.com.",
  },
  {
    label: "Missing information",
    hint: "Not enough detail",
    message: "I need an insurance quote.",
  },
];

export function formatLabel(value?: string) {
  if (!value) return "—";
  return value.replace(/_/g, " ");
}

export function decisionHeadline(decision?: Decision) {
  switch (decision) {
    case "QUALIFIED":
      return {
        title: "Lead qualified",
        note: "The request has sufficient information and the referral partner is verified and active.",
        tone: "positive" as const,
      };
    case "NOT_QUALIFIED":
      return {
        title: "Referral requires attention",
        note: "The referral code could not be verified as an active partner.",
        tone: "warning" as const,
      };
    case "NEED_MORE_INFORMATION":
      return {
        title: "More information needed",
        note: "Some details are missing before this lead can be processed.",
        tone: "neutral" as const,
      };
    default:
      return {
        title: "Lead processed",
        note: "The workflow returned a response for this request.",
        tone: "neutral" as const,
      };
  }
}
