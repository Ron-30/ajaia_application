# Architecture

## Overview

```
Browser (React SPA + TipTap editor)
   │  same-origin fetch /api/*, httpOnly session cookie
   ▼
Express (Node) ── serves built SPA from /dist and the JSON API
   │  parameterized SQL via one query(sql, params) function
   ▼
Postgres (Render managed)   ·   PGlite (embedded Postgres) for local dev & tests
```

One deployable unit: Express serves both the API and the static React build. This avoids CORS and cross-site cookie configuration and fits a single free Render web service.

## Key decisions

| Decision | Why |
|---|---|
| **TipTap (ProseMirror) editor** | Mature, MIT-licensed rich-text engine with proper schema, undo history and keyboard shortcuts; far more robust than `contenteditable` + `execCommand`. |
| **Store content as sanitized HTML** | TipTap reads/writes HTML natively, imported `.md`/`.docx` convert naturally to HTML, and it renders anywhere. Every write passes through a strict `sanitize-html` allowlist (`server/sanitize.js`) matching the editor's features, so stored XSS is impossible even if a client is bypassed. |
| **Postgres everywhere; PGlite locally** | Same SQL dialect in dev, tests and prod — no "works on SQLite, breaks on Postgres". PGlite needs no install, so `npm install && npm run dev` just works and tests get a fresh in-memory DB. `server/db.js` hides the engine behind `query()`. |
| **Autosave (debounced 800 ms) instead of a Save button** | Matches the Google Docs mental model; status chip shows Saving / Saved / Error. Pending edits are flushed on route change and via `fetch(..., {keepalive:true})` on tab close. |
| **Last-write-wins, no real-time co-editing** | Real-time collaboration (CRDT/OT + WebSockets) was out of scope for the time box. Concurrent editors can overwrite each other; noted as the main next step (Yjs + TipTap Collaboration). |
| **Lightweight auth (email + password, JWT cookie)** | Demonstrates real ownership and sharing without third-party auth setup. Seeded demo users make review easy. |

## Data model

```
users(id, email UNIQUE, name, password_hash, created_at)
documents(id, owner_id → users, title, content_html, created_at, updated_at)
document_shares(document_id → documents, user_id → users, role ∈ {viewer, editor}, PK(document_id, user_id))
```

Schema is created idempotently at startup (`CREATE TABLE IF NOT EXISTS`), and demo users are upserted. Deleting a document cascades to its shares.

## Authorization

All rules live in one function, `getAccess()` (`server/access.js`), which returns the caller's role on a document (`owner` / `editor` / `viewer`) or `null`. Every document route calls it first:

- `null` → **404** (not 403), so users can't discover which document IDs exist.
- Content edits require `owner` or `editor`; rename, share, unshare and delete require `owner`.

## Request flow: file import

`POST /api/import` (multipart) → multer (memory only, 5 MB, extension allowlist) → convert (`.docx` via mammoth after checking ZIP magic bytes, `.md` via marked, `.txt` escaped into paragraphs) → sanitize → insert as a new document owned by the caller → client navigates to it.

## Security measures

- bcrypt password hashing; generic login errors (no account enumeration); rate limiting on login/register.
- Session JWT (HS256, 7 days) in an `httpOnly`, `SameSite=Lax`, `Secure` (prod) cookie.
- helmet security headers incl. a strict Content-Security-Policy (`script-src 'self'`, `frame-ancestors 'none'`).
- zod validation on every request body; parameterized SQL only; JSON body limit 3 MB.
- Central error handler that logs server-side and never leaks stack traces.
- Secrets only from environment variables; Render generates `JWT_SECRET`; database has no public IP allow-list.

## Known limitations / next steps

- Real-time co-editing and presence (Yjs + y-websocket).
- Version history, comments, export to .docx/PDF.
- Images and tables in documents.
- Email verification / password reset / OAuth.
- Free-tier hosting: cold starts, and the free Postgres instance expires after 30 days.
