# Partner Referral Assistant

An AI-powered internal tool for processing partner referral leads. A team member pastes a lead's
natural-language request, and a multi-agent n8n workflow classifies it, extracts the lead details,
verifies the referral partner, decides the next action, and writes the customer response.

## Project overview

- One primary workflow screen — no dashboards, no login.
- The message is sent to a real n8n webhook. The UI renders only what the workflow returns.
- Three business outcomes are supported: `QUALIFIED`, `NOT_QUALIFIED`, `NEED_MORE_INFORMATION`.
- Sales and partner notification emails returned by the workflow are shown in an expandable
  "View workflow details" section.

Nothing in the UI is mocked, hardcoded, or simulated.

## Architecture

```text
Frontend (React + TanStack Start)
  -> server function proxy (/lib/n8n.functions.ts)
    -> n8n webhook
      -> Classifier Agent
      -> Extractor Agent
      -> Google Sheets partner lookup
      -> Reasoner Agent
      -> Composer Agent
      -> Final JSON response
```

The webhook call is isolated in a single reusable function, `processLead(message)`, in
`src/lib/n8n.functions.ts`. It runs server-side so the browser is never blocked by cross-origin
restrictions on the n8n endpoint; the payload and response pass through untouched.

Expected response shape:

```json
{
  "status": "success",
  "customer_message": "...",
  "sales_email": { "subject": "...", "body": "..." },
  "partner_email": { "subject": "...", "body": "..." },
  "decision": "QUALIFIED",
  "next_action": "PROCESS_LEAD"
}
```

Arrays and `{ json: ... }` / `{ output: ... }` wrappers that n8n sometimes emits are unwrapped
automatically.

## Project structure

```text
src/
  components/
    LeadForm.tsx          form, character count, example chips
    ProcessingState.tsx   processing indicator
    ResultCard.tsx        decision, next action, customer response, copy button
    WorkflowDetails.tsx   expandable sales/partner notifications
    ErrorState.tsx        failure state with retry
  lib/
    n8n.ts                shared types, examples, decision copy
    n8n.functions.ts      the single webhook call
  routes/
    index.tsx             the main workflow screen
```

## Local development

Requires Node.js 20+ (or Bun).

```bash
npm install
npm run dev      # http://localhost:8080
npm run build    # production build
npm run lint
```

## Environment variables

The webhook URL is configurable, so it can be swapped without touching code:

| Variable           | Purpose                                    |
| ------------------ | ------------------------------------------ |
| `N8N_WEBHOOK_URL`  | Webhook the workflow request is POSTed to. |

`VITE_N8N_WEBHOOK_URL` is also accepted for parity with Vite/Next-style conventions
(`NEXT_PUBLIC_N8N_WEBHOOK_URL` in a Next.js port). When unset, the app falls back to the current
n8n **test** endpoint defined as `DEFAULT_WEBHOOK_URL` in `src/lib/n8n.functions.ts`:

```text
https://gayiti.app.n8n.cloud/webhook-test/7e14d6cc-1f42-4bf3-b027-5ee040a6c114
```

Example `.env`:

```bash
N8N_WEBHOOK_URL=https://gayiti.app.n8n.cloud/webhook/7e14d6cc-1f42-4bf3-b027-5ee040a6c114
```

No OpenAI, Google, or n8n API credentials are needed by the frontend — only the webhook URL. Never
commit `.env` files (already covered by `.gitignore`).

## Workflow outcomes

| Decision                | UI headline                    | Typical next action          |
| ----------------------- | ------------------------------ | ---------------------------- |
| `QUALIFIED`             | Lead qualified                 | `PROCESS_LEAD`               |
| `NOT_QUALIFIED`         | Referral requires attention    | `REQUEST_VALID_REFERRAL`     |
| `NEED_MORE_INFORMATION` | More information needed        | `REQUEST_MORE_INFORMATION`   |

In every case the customer-facing text shown is the workflow's own `customer_message`.

## Error handling

- **Empty input** — blocked client-side with "Please enter a message before submitting." The webhook
  is not called.
- **Network failure, timeout (120s), non-2xx, unreadable or unexpected JSON** — a single clear error
  state: "We couldn't process this request", with a **Try again** button.
- Technical detail (status codes, response bodies, stack traces) goes to the console/server logs
  only, never to the screen.

## Known limitations

- The default endpoint is the n8n **test** webhook. n8n only accepts one call per click of
  "Execute workflow" in the editor, so the app will show its error state until the workflow is armed.
  Replace it with the production `/webhook/...` URL via `N8N_WEBHOOK_URL` before any real deployment.
- Processing stages shown while loading are a visual indication of progress, not per-agent telemetry;
  n8n does not stream intermediate state.
- No persistence — submitted leads are not stored by the frontend.

## Deployment

Any Node-compatible host works. For Vercel:

1. Push the repository to GitHub.
2. Import the project in Vercel.
3. Build command `npm run build`; the framework preset is detected automatically.
4. Add the environment variable `N8N_WEBHOOK_URL` with the production webhook URL.
5. Deploy. The app is publicly accessible with no authentication.
