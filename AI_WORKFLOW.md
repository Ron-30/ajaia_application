# AI Workflow

This project was built in a single ~1-hour session with **Claude Code** (Anthropic's agentic coding CLI, model Claude Opus) acting as a pair programmer, with me directing scope, reviewing and approving each phase.

## How the work was split

| Step | Human | AI (Claude Code) |
|---|---|---|
| Requirements | Provided the task brief and deliverables; set constraints (free services only, 1-hour limit, security best practices, Google Docs look & feel) in `CLAUDE.md`. | Asked clarifying questions (hosting, GitHub repo creation, check-in cadence) before writing code. |
| Planning | Reviewed and approved the plan. | Wrote a plan: stack, data model, permission rules, security list, test plan, deploy path, build order. |
| Implementation | — | Scaffolded the repo, wrote the Express API, DB layer, React/TipTap UI and styles. Installed the Anthropic `frontend-design` skill to guide the UI. |
| Verification | Manual review in the browser. | Wrote 18 API integration tests (auth, permissions, XSS sanitization, import) and ran them; built the frontend; ran the production server and smoke-tested with curl; took a headless-browser screenshot to check rendering. |
| Deploy | Created the GitHub repo and connected Render (account actions). | Wrote `render.yaml`, committed and pushed, verified the live URL. |
| Docs | Reviewed. | Drafted README, ARCHITECTURE, this note and SUBMISSION. |

## Where AI helped most

- **Speed on boilerplate:** Express setup, zod schemas, CSS for a Google Docs look, test scaffolding.
- **Security checklist applied consistently:** sanitization, cookie flags, CSP, rate limits, 404-not-403, upload validation — the AI applied these by default rather than as an afterthought.
- **Choosing pragmatic tools:** e.g. PGlite so local dev and tests run real Postgres with zero setup.

## Where human judgment / correction mattered

- Scope control: explicitly chose *not* to build real-time co-editing to stay within the time box.
- Hosting choice and account setup (GitHub, Render) are human actions.
- Bugs caught by running the code, not by reading it: the local DB directory wasn't created on first start (fixed in `server/db.js`), and Express 4 doesn't forward async errors (switched to Express 5). Tests and a real smoke run were essential — AI-written code was treated as a draft until verified.

## Prompts / process notes

- Work was driven from a `CLAUDE.md` file that sets standing rules (explain simply, free dependencies only, security best practices, test every stage).
- One plan was approved up front; the AI then executed autonomously and reported back with a feature list and best-practices summary.
