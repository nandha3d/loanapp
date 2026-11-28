<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Read `ENGINEERING_REFERENCE.md` before changing anything

`ENGINEERING_REFERENCE.md` at the repo root is the **normative** architecture and business-logic
reference for this project. It is binding, not advisory.

- Read **§16.0 "Change discipline"** first. It is the standing rule for this repo: shipped
  behaviour is frozen, new capability is additive and defaults to today's behaviour, the four
  scoping axes never widen, nothing is hardcoded, every string ships in all six locales,
  every calculation is done on the server and the clients only render API values (STABLE-8), and
  `npm run test:calc` is green before and after. Existing logic changes **only** for a
  demonstrated defect — never to tidy or modernise.
- Read §0–§5 (precedence, stack, structure, request lifecycle, the four scoping axes) before any change.
- Read §10 in full before any change that touches money, schedules, penalties, float or accounting.
- Its rules are numbered (`SCOPE-3`, `MONEY-10`, `X-6`, …). Cite the id when rejecting or justifying a change.
- §17 "Forbidden patterns" lists what has already shipped a bug here. Do not reintroduce them.
- If a change makes a rule false, update `ENGINEERING_REFERENCE.md` in the same commit (rule DOC-1).
- Where any other document (`docs/**`, `.planning/**`, older specs) disagrees with it, it wins.

# Strict UI/UX Design Rule (No Default AI Styling & Theme Fidelity)

- **BANNED "AI default" UI patterns — NEVER use any of these**:
  - **NEVER use thick left-side accent borders / left-side shade bars on rounded cards or callout boxes** (e.g., `border-left: 3px/4px/5px solid ...`, crescent left-edge stripes on cards/banners/alerts).
  - **NEVER clip popovers, dropdowns, or `(i)` help tooltips inside scrollable/overflow containers** (`overflow: hidden` / `overflow-x: auto`). Always render floating tooltips and popovers using `createPortal(..., document.body)` with `position: fixed` anchored via `getBoundingClientRect()` and viewport edge clamping.
  - **NEVER ship generic stacked white boxes**, monotonous grey borders, unstyled vertical `form-control` walls, raw developer JSON textareas for end-users, or cookie-cutter boilerplate cards.
- **MANDATORY Project Theme & Template Usage (NO Hardcoding)**:
  - **NEVER hardcode UI surface/text/accent colors** (`#0f172a`, `#f8fafc`, `#cbd5e1`, `#16a34a` gradients, etc.) where project CSS theme variables belong. **ALWAYS** style components using the active tenant/module CSS custom properties from `app/globals.css` and module stylesheets (`var(--primary)`, `var(--primary-dark)`, `var(--primary-light)`, `var(--primary-tint)`, `var(--primary-border)`, `var(--primary-glow)`, `var(--surface)`, `var(--bg)`, `var(--text)`, `var(--text-secondary)`, `var(--border)`, `var(--success)`, `var(--warning)`, `var(--danger)`), and reuse the module's existing hero banner (`*-hero`), card shell (`*-card`), and button classes.
  - **NEVER hardcode non-localized user-facing strings when module `dict` translations apply** — every new label/action must integrate with `i18n/{en,ta,hi,te,kn,ml}.ts` (`STABLE-5`).
- **Visual hierarchy & polish are mandatory**: use intentional depth (layered shadows, subtle ambient glows, uniform crisp borders, tinted header strips, spacious accessible fonts, minimal clicks, and plain-language `(i)` guidance for non-technical users).

# Persistent Project Session Memory (`SESSION_MEMORY.md`)

- **MANDATORY on every session start & prompt**: Read `SESSION_MEMORY.md` at the repo root alongside `ENGINEERING_REFERENCE.md` before making changes so architectural choices, auth setup, UI/theme bans, and user preferences are never forgotten.
- **MANDATORY after completing every user request**: Summarize the request, key decisions, modified files, and any pending manual steps concisely at the bottom of `SESSION_MEMORY.md` under `## Session History` so future AI sessions always have up-to-date context.
