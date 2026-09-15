# Agent Skills (OpenCode)

This project uses skills installed under `.opencode/skills/` (and `.agents/skills/` as cross-compatible fallback).
Global fallback: `~/.config/opencode/skills/`, `~/.agents/skills/`, `~/.opencode/skills/`.

Source pack: `addyosmani/agent-skills` (25 skills, project-local) + global skills from `emilkowalski/skill`, `vercel-labs/skills`, etc.

## Core Rules

- If a task matches a skill, invoke it with the `skill` tool before acting.
- Skills are located in `.opencode/skills/<skill-name>/SKILL.md` (mirror of `.agents/skills/<skill-name>/SKILL.md`).
- Follow the skill workflow strictly; do not partially apply it.
- Never skip required steps such as spec, plan, or test when a skill demands them.

## Intent → Skill Mapping

Map the user's intent to the matching skill automatically:

- Feature / new functionality → `spec-driven-development`, then `incremental-implementation` and `test-driven-development`
- Planning / breakdown → `planning-and-task-breakdown`
- Bug / failure / unexpected behavior → `debugging-and-error-recovery`
- Code review → `code-review-and-quality`
- Refactoring / simplification → `code-simplification`
- API or interface design → `api-and-interface-design`
- UI work → `frontend-ui-engineering`
- CI/CD, pipelines, automation → `ci-cd-and-automation`
- Browser testing, DOM, network, console → `browser-testing-with-devtools`
- Context bloat, session setup → `context-engineering`
- Deprecation, migration, schema change → `deprecation-and-migration`
- ADRs, docs, decisions → `documentation-and-adrs`
- High-stakes decision, adversarial review → `doubt-driven-development`
- Git workflow, branches, commits, releases → `git-workflow-and-versioning`
- Vague idea, ideation → `idea-refine`
- Clarifying questions → `interview-me`
- Logging, metrics, tracing → `observability-and-instrumentation`
- Performance, N+1, Web Vitals → `performance-optimization`
- Auth, input handling, OWASP, secrets → `security-and-hardening`
- Release, rollout, monitoring, rollback → `shipping-and-launch`
- Verify against official docs → `source-driven-development`
- Quality bar, constraints → `constraint-driven-development`
- How to use skills → `using-agent-skills`

## Lifecycle Mapping (Implicit Commands)

- DEFINE → `spec-driven-development`
- PLAN → `planning-and-task-breakdown`
- BUILD → `incremental-implementation` + `test-driven-development`
- VERIFY → `debugging-and-error-recovery`
- REVIEW → `code-review-and-quality`
- SHIP → `shipping-and-launch`

## Execution Model

For every request:

1. Determine if any skill applies (even a small chance).
2. Load the skill with `skill({ name: "<skill-name>" })`.
3. Follow the skill workflow exactly.
4. Only proceed to implementation once required steps are complete.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
