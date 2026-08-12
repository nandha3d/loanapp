<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Read `ENGINEERING_REFERENCE.md` before changing anything

`ENGINEERING_REFERENCE.md` at the repo root is the **normative** architecture and business-logic
reference for this project. It is binding, not advisory.

- Read §0–§5 (precedence, stack, structure, request lifecycle, the four scoping axes) before any change.
- Read §10 in full before any change that touches money, schedules, penalties, float or accounting.
- Its rules are numbered (`SCOPE-3`, `MONEY-10`, `X-6`, …). Cite the id when rejecting or justifying a change.
- §16 "Forbidden patterns" lists what has already shipped a bug here. Do not reintroduce them.
- If a change makes a rule false, update `ENGINEERING_REFERENCE.md` in the same commit (rule DOC-1).
- Where any other document (`docs/**`, `.planning/**`, older specs) disagrees with it, it wins.
