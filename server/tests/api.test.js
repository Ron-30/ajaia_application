// API integration tests: real Express app + in-memory PGlite Postgres.
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createDb, DEMO_PASSWORD } from '../db.js';
import { createApp } from '../app.js';

let db, app;

beforeAll(async () => {
  db = await createDb({ dataDir: 'memory://' });
  app = createApp({ db, jwtSecret: 'test-secret' });
}, 30_000);
afterAll(() => db?.close());

async function login(email) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email, password: DEMO_PASSWORD });
  expect(res.status).toBe(200);
  return agent;
}

describe('auth', () => {
  it('rejects wrong password with a generic error', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'alice@demo.com', password: 'wrongpass' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid email or password');
  });

  it('sets an httpOnly session cookie on login', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'alice@demo.com', password: DEMO_PASSWORD });
    expect(res.headers['set-cookie'][0]).toMatch(/HttpOnly/i);
    expect(res.headers['set-cookie'][0]).toMatch(/SameSite=Lax/i);
  });

  it('blocks API access without a session', async () => {
    expect((await request(app).get('/api/documents')).status).toBe(401);
  });

  it('registers a new user and rejects duplicates', async () => {
    const body = { name: 'Dana', email: 'dana@example.com', password: 'longpassword' };
    expect((await request(app).post('/api/auth/register').send(body)).status).toBe(201);
    expect((await request(app).post('/api/auth/register').send(body)).status).toBe(409);
  });
});

describe('documents & sharing', () => {
  let alice, bob, carol, docId;

  beforeAll(async () => {
    alice = await login('alice@demo.com');
    bob = await login('bob@demo.com');
    carol = await login('carol@demo.com');
  });

  it('creates, renames, saves and reopens a document with formatting', async () => {
    const created = await alice.post('/api/documents').send({});
    expect(created.status).toBe(201);
    docId = created.body.document.id;

    const html = '<h1>Plan</h1><p><strong>Bold</strong> <em>it</em> <u>under</u></p><ul><li><p>one</p></li></ul>';
    expect((await alice.patch(`/api/documents/${docId}`).send({ title: 'Q3 Plan', content_html: html })).status).toBe(200);

    const reopened = await alice.get(`/api/documents/${docId}`);
    expect(reopened.body.document.title).toBe('Q3 Plan');
    expect(reopened.body.document.content_html).toBe(html);
    expect(reopened.body.document.role).toBe('owner');
  });

  it('strips scripts and event handlers from saved HTML (XSS)', async () => {
    await alice.patch(`/api/documents/${docId}`).send({ content_html: '<p onclick="x()">Hi<script>alert(1)</script><img src=x onerror=alert(1)></p>' });
    const { body } = await alice.get(`/api/documents/${docId}`);
    expect(body.document.content_html).toBe('<p>Hi</p>');
  });

  it('hides documents from users without access (404)', async () => {
    expect((await bob.get(`/api/documents/${docId}`)).status).toBe(404);
    expect((await bob.patch(`/api/documents/${docId}`).send({ content_html: 'x' })).status).toBe(404);
  });

  it('only the owner can share', async () => {
    expect((await bob.post(`/api/documents/${docId}/shares`).send({ email: 'bob@demo.com' })).status).toBe(404);
  });

  it('viewer can read but not edit', async () => {
    const res = await alice.post(`/api/documents/${docId}/shares`).send({ email: 'bob@demo.com', role: 'viewer' });
    expect(res.status).toBe(201);
    const got = await bob.get(`/api/documents/${docId}`);
    expect(got.status).toBe(200);
    expect(got.body.document.role).toBe('viewer');
    expect((await bob.patch(`/api/documents/${docId}`).send({ content_html: '<p>hack</p>' })).status).toBe(403);
  });

  it('editor can edit content but not rename, share or delete', async () => {
    await alice.post(`/api/documents/${docId}/shares`).send({ email: 'carol@demo.com', role: 'editor' });
    expect((await carol.patch(`/api/documents/${docId}`).send({ content_html: '<p>Carol was here</p>' })).status).toBe(200);
    expect((await carol.patch(`/api/documents/${docId}`).send({ title: 'Mine now' })).status).toBe(403);
    expect((await carol.post(`/api/documents/${docId}/shares`).send({ email: 'bob@demo.com', role: 'editor' })).status).toBe(403);
    expect((await carol.delete(`/api/documents/${docId}`)).status).toBe(403);
  });

  it('lists owned vs shared documents distinctly', async () => {
    const a = (await alice.get('/api/documents')).body.documents.find((d) => d.id === docId);
    const b = (await bob.get('/api/documents')).body.documents.find((d) => d.id === docId);
    expect(a.role).toBe('owner');
    expect(b.role).toBe('viewer');
    expect(b.owner_name).toBe('Alice Johnson');
  });

  it('revoking a share removes access', async () => {
    const { body } = await alice.get(`/api/documents/${docId}/shares`);
    const bobShare = body.shares.find((s) => s.email === 'bob@demo.com');
    expect((await alice.delete(`/api/documents/${docId}/shares/${bobShare.user_id}`)).status).toBe(204);
    expect((await bob.get(`/api/documents/${docId}`)).status).toBe(404);
  });

  it('sharing with an unknown email fails clearly', async () => {
    const res = await alice.post(`/api/documents/${docId}/shares`).send({ email: 'nobody@demo.com' });
    expect(res.status).toBe(404);
  });

  it('owner can delete', async () => {
    expect((await alice.delete(`/api/documents/${docId}`)).status).toBe(204);
    expect((await alice.get(`/api/documents/${docId}`)).status).toBe(404);
  });
});

describe('file import', () => {
  let alice;
  beforeAll(async () => { alice = await login('alice@demo.com'); });

  it('imports Markdown as formatted HTML', async () => {
    const res = await alice.post('/api/import').attach('file', Buffer.from('# Title\n\n**bold** and *it*\n\n- a\n- b\n'), 'notes.md');
    expect(res.status).toBe(201);
    expect(res.body.document.title).toBe('notes');
    const doc = (await alice.get(`/api/documents/${res.body.document.id}`)).body.document;
    expect(doc.content_html).toContain('<h1>Title</h1>');
    expect(doc.content_html).toContain('<strong>bold</strong>');
    expect(doc.content_html).toContain('<ul>');
  });

  it('imports plain text as escaped paragraphs', async () => {
    const res = await alice.post('/api/import').attach('file', Buffer.from('Hello <world>\n\nSecond'), 'a.txt');
    const doc = (await alice.get(`/api/documents/${res.body.document.id}`)).body.document;
    expect(doc.content_html).toBe('<p>Hello &lt;world&gt;</p><p>Second</p>');
  });

  it('rejects unsupported file types', async () => {
    const res = await alice.post('/api/import').attach('file', Buffer.from('x'), 'evil.exe');
    expect(res.status).toBe(400);
  });

  it('rejects a fake .docx', async () => {
    const res = await alice.post('/api/import').attach('file', Buffer.from('not a zip'), 'fake.docx');
    expect(res.status).toBe(422);
  });
});
