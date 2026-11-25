---
name: compress-context
description: >
  Use this skill when asked to create a CLAUDE.md, context file, or memory file
  for a codebase module. Generates a token-optimized markdown file that gives
  Claude maximum information in minimum tokens. Triggers: "make a skill file",
  "reduce token usage", "create CLAUDE.md", "compress context", "make claude
  understand this module faster", "write a context file for this feature".
---

# Skill: Compress Module Context for Claude

## Goal
Generate a `CLAUDE.md` (or named `MODULE_NAME.md`) that lets Claude understand
a codebase module **without reading source files** — reducing token spend by
~70% on repeat tasks.

---

## Output Rules

### 1. Use tables over prose
```md
| Field | Type | Rule |
|---|---|---|
| name | text | required |
```
NOT: "The name field is a required text input that..."

### 2. Use code blocks for schemas/patterns
```prisma
Model { id, field Type, computed? }
```
NOT: prose description of every field

### 3. Checkbox lists for todos
```
[ ] Feature missing — file to edit
[ ] Another gap — action needed
```

### 4. Show computed formulas explicitly
```
dividend = (bidDiscount - commission) / (totalMembers - 1)
```

### 5. Cross-reference existing patterns
```
Follow /api/loans/[id]/receipt pattern
Copy CustomerForm.tsx structure
```
NOT: re-explain what those patterns do.

### 6. Status enums inline
```
status: active | completed | cancelled
```

### 7. Group by priority with `P0/P1/P2`
P0 = bugs, P1 = missing actions, P2 = missing pages

---

## Template Structure

```md
# MODULE_NAME — Implementation Context
> One-line purpose. Read before editing any /module files.

## STACK
[only non-obvious parts]

## FILE MAP
[tree of relevant files only, with one-line purpose each]

## DB SCHEMA
[prisma-style compact notation]

## EXISTING ACTIONS
[function signature + numbered steps + key validations]

## PAGE SPECS
[per page: KPIs, filters, table cols, modal fields as compact tables]

## AUTH & ACCESS
[role rules + module gate pattern]

## KEY PATTERNS
[reusable code snippets already in codebase]

## WHAT'S MISSING
[P0/P1/P2 checkbox lists with file to edit]

## BUILD ORDER
[numbered steps, each one sentence, paste-ready for Claude Code]

## COMPUTED FIELDS
[formula reference block]

## STATUS VALUES
[enum table]
```

---

## Token Budget Targets

| Section | Target |
|---|---|
| File map | < 15 lines |
| DB schema | < 25 lines (all models) |
| Per action | < 10 lines |
| Per page spec | < 20 lines |
| Missing features | < 30 lines total |
| **Total file** | **< 200 lines / ~1,500 tokens** |

---

## What to Omit

- Import statements
- Boilerplate auth setup (reference it, don't repeat it)
- CSS/styling details
- Error handling boilerplate (unless unusual)
- Fields that use framework defaults
- Prose explanation when a table communicates the same thing

---

## How to Generate

1. Read the module's files (page.tsx, actions.ts, client components, schema)
2. Identify: existing features, missing features, DB models, auth rules, patterns
3. Fill the template above — compress aggressively
4. Save as `CLAUDE.md` in the module folder OR as `MODULE_NAME.md` in project root
5. Tell user: "Place this file in your project root or module folder. Claude Code
   will auto-read CLAUDE.md at session start."

---

## Placement Guide

| File name | Where | When read |
|---|---|---|
| `CLAUDE.md` | Project root | Every Claude Code session auto |
| `CLAUDE.md` | Sub-folder | When Claude opens that folder |
| `MODULE.md` | Project root | Only when explicitly @-mentioned |
| `.claude/context/MODULE.md` | .claude folder | @-mention as @context/MODULE |

**Recommendation:** For large apps, put one `CLAUDE.md` per major module folder
(e.g. `app/(dashboard)/chits/CLAUDE.md`) rather than one giant root file.

---

## Example Compression Ratio

| Format | Tokens (approx) |
|---|---|
| Reading 6 source files | ~8,000 tokens |
| This skill's output MD | ~1,200 tokens |
| **Savings** | **~85%** |
