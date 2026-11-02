# Submission — AJAIA Docs

| Deliverable | Location |
|---|---|
| Source code | `server/` (Express API, DB, tests), `client/` (React + TipTap UI), `package.json`, `render.yaml` |
| README with local setup & run instructions | [README.md](README.md) |
| Architecture note | [ARCHITECTURE.md](ARCHITECTURE.md) |
| AI workflow note | [AI_WORKFLOW.md](AI_WORKFLOW.md) |
| Live product URL | https://ajaia-docs.onrender.com (also at the top of the README) |
| Walkthrough video URL | [VIDEO_URL.txt](VIDEO_URL.txt) |
| Screenshots | [docs/screenshots/](docs/screenshots/) |
| Automated tests | `server/tests/api.test.js` — run with `npm test` |

## How to test quickly

1. Open the live URL (allow ~30–50 s for the free server to wake up).
2. Click **Sign in as Alice** → **Blank document** → type, format (bold, headings, lists), rename via the title.
3. Click **Share** → add `bob@demo.com` as **Viewer**.
4. Sign out (avatar, top right) → **Sign in as Bob** → filter **Shared with me** → open the doc: it is read-only.
5. As anyone, use **Import a file** with a `.txt`, `.md` or `.docx` file → it opens as a new editable document.
6. Refresh at any point — everything persists.

Demo accounts: `alice@demo.com`, `bob@demo.com`, `carol@demo.com` — password `demo1234`.

## Scope notes

- Supported import types: `.txt`, `.md`, `.docx` (max 5 MB), stated in the UI and README.
- Not included (by design, for the time box): real-time co-editing, comments, version history. See ARCHITECTURE.md → next steps.
