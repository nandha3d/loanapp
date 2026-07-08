# Self-Healing SDLC (n8n + Playwright + Claude Code)

Local dev machine runs Playwright and Claude Code. n8n runs self-hosted on
the VPS. The dev machine has no inbound port reachable from the VPS, so
control is **not** pushed from n8n to local — the local healer loop owns
retries and **reports** to n8n. n8n is the audit log, circuit-breaker
witness, and escalation notifier, not the real-time commander.

```
git push (local) → pre-push hook → healer.mjs
                                      │
                          ┌───────────┴───────────┐
                          │   run → detect → analyze → heal → recover  │
                          └───────────┬───────────┘
                                      │ status POSTs (HMAC-signed)
                                      ▼
                         n8n webhook (VPS, self-hosted)
                          ├─ run_passed      → log only
                          ├─ run_healed      → notify "fixed in N attempts"
                          └─ run_escalate    → email/Slack with full report, BLOCK push
```

## Strict rules

1. **Max 3 healing attempts per push.** Hard stop, no override flag. Past
   attempt 3 it's a real logic error, not a flaky locator — needs a human.
2. **Kill switch first.** `SELF_HEAL_ENABLED=false` (env) disables the loop
   instantly and lets Playwright fail normally. Check this before anything
   else runs.
3. **Branch guard.** Refuses to run on `main`/`master`. Self-heal only
   operates on feature branches.
4. **Never touch the test files.** The healer is only allowed to patch
   source under typical app dirs (app/, lib/, components/, prisma/, etc.).
   If the failure looks like a bad/flaky test (assertion contradicts a
   spec'd requirement, selector that never existed), it must **stop and
   escalate**, not "fix" the test to match buggy code.
5. **Never push, force-push, or merge.** The healer commits locally only,
   tagged `[self-heal]` in the message. The original `git push` that
   triggered the hook is **blocked** until either (a) tests pass clean, or
   (b) human re-runs after manual review. No auto-push, ever.
6. **No bypassed permissions.** Claude Code runs with
   `--permission-mode acceptEdits` (auto-accept file edits only). Never
   `--dangerously-skip-permissions` — arbitrary bash/network calls still
   need a human in the loop.
7. **Secrets never leave the machine.** Payloads sent to n8n are redacted
   (env values, anything matching `DATABASE_URL`, `*_SECRET`, `*_KEY`,
   `*_PASSWORD`, `*_TOKEN` patterns) before they're serialized.
8. **Webhook payloads are signed.** HMAC-SHA256 over the raw body using a
   shared secret (`N8N_WEBHOOK_SECRET`), verified in the n8n Code node
   before any branch executes. n8n is internet-reachable; unsigned
   payloads are dropped.
9. **Rate limit.** One healing run per branch per 10 minutes minimum
   (healer.mjs writes a local lockfile timestamp) — stops a bad save-loop
   from burning Claude Code credits.
10. **Every attempt is logged**, pass or fail, with the diff produced.
    Escalation mail includes all attempted diffs, not just the last one —
    a human reviewing should see the whole trail.

## Components

- `scripts/self-heal/healer.mjs` — the loop driver (local machine).
- `.githooks/pre-push` — trigger. Install once: `npm run hooks:install`.
- `n8n/self-healing-workflow.json` — importable n8n workflow (webhook →
  verify signature → switch on event → notify/escalate).
- `scripts/self-heal/generate-tests.mjs` + `docs/test-case-checklist.md` —
  per-module Playwright spec drafting.
- `e2e/link-check.spec.ts` — dead-link crawl, internal links block the
  build, external ones just get logged.

## Test case builder (per module)

`npm run gen:tests -- <module>` drafts `e2e/<module>/<module>.spec.ts`.
It doesn't template blindly — it points Claude Code at the real
`app/api/v1/<module>` routes, the matching dashboard UI, and
`prisma/schema.prisma`, and has it write tests against the category list
in `docs/test-case-checklist.md` (happy path, RBAC boundary, validation,
empty state, pagination, concurrency/idempotency, unauthorized, UI error
surfaces, link integrity, money/number correctness). Categories that
don't apply to a module are skipped rather than padded with fake tests.
**Always review generated specs** — the generator drafts against a
checklist, it doesn't know your business rules.

## Link checking

`npm run test:links` runs `e2e/link-check.spec.ts`: crawls same-origin
pages (marketing pages unauthenticated; dashboard too if
`E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD` are set), collects every `<a href>`,
and HEAD/GET-checks each one. **Internal dead links fail the test**
(these block a push through the healer loop like any other failure).
External dead links are logged as warnings only — a third party's outage
isn't something an auto-patch can fix, and shouldn't block your push.

## Model routing — Claude Code vs Antigravity, and token budget

Two separate concerns get conflated easily here, so split them:

- **Does Playwright cost tokens?** No. Playwright runs entirely locally —
  zero LLM calls. The token cost is 100% what `healer.mjs` pastes into
  the prompt sent to the agent (error messages, snippets, prior diffs).
  That's the thing actually worth budgeting.
- **Where the budget actually gets controlled:** `healer.mjs` caps
  error/snippet text at `SELF_HEAL_MAX_ERROR_CHARS` (default 1500 chars)
  and diffs at `SELF_HEAL_MAX_DIFF_CHARS` (default 3000 chars), and only
  includes the **most recent** prior diff in full — earlier attempts are
  summarized to one line each. Without this, a 3-attempt loop would paste
  every previous diff into every subsequent prompt and grow roughly
  quadratically.
- **Effort scales with attempt number**, not flat every time: attempt 1
  runs `--effort low` (most single-test Playwright failures are a bad
  locator or stale assertion — don't burn a deep reasoning pass on that),
  attempt 2 `medium`, attempt 3 `high`. Override the model itself with
  `SELF_HEAL_MODEL` if you want e.g. Haiku for attempt 1.
- **Antigravity** (Google's agentic IDE) is wired in as an optional
  second opinion on the *final* attempt only — if Claude Code's three
  escalating attempts all fail, attempt 3 routes to Antigravity instead
  (different model family, fresh take, before giving up to a human). This
  is opt-in via `ANTIGRAVITY_CMD` (a command template, see
  `scripts/self-heal/healer.mjs`) — **its exact non-interactive CLI flags
  aren't something this doc can promise are correct**, fill in the real
  invocation yourself and verify it once manually before trusting it in
  the loop.

## Required env (local machine, add to `.env`)

```
SELF_HEAL_ENABLED=true
N8N_WEBHOOK_URL=https://<your-vps-n8n-host>/webhook/self-heal-status
N8N_WEBHOOK_SECRET=<shared secret, also set in the n8n Code node>
SELF_HEAL_MAX_RETRIES=3
```

`claude` CLI must already be authenticated on the local machine
(`claude auth` / existing session) — the healer shells out to it directly,
no API key handling inside the script.

## Required env (n8n, on the VPS — Docker)

n8n here runs in Docker, so `$env.SELF_HEAL_WEBHOOK_SECRET` used by the
Code node has to come from the container's environment, not the host
shell. Add it to whatever passes env into the n8n service — e.g. in
`docker-compose.yml`:

```yaml
services:
  n8n:
    environment:
      - SELF_HEAL_WEBHOOK_SECRET=<same shared secret as N8N_WEBHOOK_SECRET>
      - SELF_HEAL_FROM_EMAIL=alerts@yourdomain
      - SELF_HEAL_NOTIFY_EMAIL=you@yourdomain
```

or an `--env-file` mounted into the container. Restart the container
after changing it — n8n doesn't hot-reload container env vars.

Email node reuses the project's existing Brevo SMTP credentials (see
prod email setup) — point n8n's SMTP credential at the same Brevo
account, or use a separate sender so escalation mail doesn't share
sending reputation with verification/reset mail.

## What "analyze root cause" means here, concretely

The healer doesn't hand Claude Code a bare stack trace. The prompt built
for each attempt includes:

- Failing test title + file:line
- Full Playwright error message and matcher diff
- The locator that failed and a DOM snapshot excerpt around it (from the
  Playwright trace, if `trace: on-first-retry` produced one)
- Screenshot path (referenced, not embedded — Claude Code reads it
  locally)
- Prior attempt's diff, if this is attempt 2 or 3 (so it doesn't repeat
  a fix that already failed)
