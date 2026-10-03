import test from 'node:test';
import assert from 'node:assert/strict';
import { github } from './packages/core/github.js';
import { draftStore } from './packages/core/storage.js';
import { filename, isDraft, setDraft } from './packages/core/document.js';
const config = { repository: 'pato/blog', branch: 'main', contentDir: 'content/posts', contentRoot: 'content', exclude: ['private', 'templates'] };
const encode = text => Buffer.from(text).toString('base64');
const json = (data, status = 200) => new Response(JSON.stringify(data), { status });
function repository() {
  const files = new Map(), calls = [];
  let commits = 0, lost = false, denied = false;
  const request = async (url, options) => {
    calls.push({ url, ...options });
    if (denied) return json({ message: 'Denied' }, 403);
    if (url.includes('/git/trees/')) return json({ tree: [...files].map(([path, file]) => ({ path, sha: file.sha, type: 'blob' })) });
    const path = decodeURIComponent(new URL(url).pathname.split('/contents/')[1]);
    const existing = files.get(path);
    if (!options.method) return existing ? json({ ...existing, content: encode(existing.text) }) : json({}, 404);
    const body = JSON.parse(options.body);
    if (existing ? body.sha !== existing.sha : Boolean(body.sha)) return json({ message: 'SHA mismatch' }, 422);
    if (options.method === 'DELETE') files.delete(path);
    else files.set(path, { text: Buffer.from(body.content, 'base64').toString(), sha: `sha-${commits + 1}` });
    commits++;
    if (lost) { lost = false; throw new TypeError('Response lost'); }
    return json({ content: files.get(path) || null, commit: { html_url: 'https://github.com/pato/blog/commit/test' } });
  };
  return { files, calls, request, get commits() { return commits; }, lose() { lost = true; }, deny() { denied = true; } };
}
test('UTF-8 create, update stable path, and singular delete', async () => {
  const repo = repository(), api = github(config, () => 'test-token', repo.request);
  const text = '---\ntitle: "João’s ideas!"\n---\n\nOlá 🦆';
  const path = `content/posts/${filename(text)}`;
  const created = await api.save(path, text);
  assert.equal(repo.files.get(path).text, text);
  assert.equal(JSON.parse(repo.calls[0].body).sha, undefined);
  const file = await api.read(path);
  assert.equal(file.text, text);
  await api.save(path, text.replace('ideas', 'thoughts'), created.sha);
  assert.equal(repo.files.size, 1);
  assert.equal(JSON.parse(repo.calls[2].body).sha, created.sha);
  await api.remove(path, repo.files.get(path).sha);
  assert.equal(repo.files.size, 0); assert.equal(repo.commits, 3);
});
test('existing filenames cannot be overwritten by create', async () => {
  const repo = repository(), api = github(config, () => 'token', repo.request);
  await api.save('content/posts/post.md', 'original');
  await assert.rejects(api.save('content/posts/post.md', 'different'), /already exists/);
  assert.equal(repo.files.get('content/posts/post.md').text, 'original'); assert.equal(repo.commits, 1);
});
test('lost create and update responses reconcile without duplicate commits', async () => {
  const repo = repository(), api = github(config, () => 'token', repo.request);
  repo.lose(); const saved = await api.save('content/posts/post.md', '🦆');
  assert.equal(saved.sha, 'sha-1'); assert.equal(repo.commits, 1);
  repo.lose(); const updated = await api.save('content/posts/post.md', 'new 🦆', saved.sha);
  assert.equal(updated.sha, 'sha-2'); assert.equal(repo.commits, 2);
});
test('lost deletion response verifies absence', async () => {
  const repo = repository(), api = github(config, () => 'token', repo.request);
  const file = await api.save('content/posts/post.md', 'original'); repo.lose();
  await api.remove('content/posts/post.md', file.sha); assert.equal(repo.commits, 2);
});
test('denied credentials never write or attempt recovery', async () => {
  const repo = repository(), api = github(config, () => 'token', repo.request); repo.deny();
  await assert.rejects(api.save('content/posts/post.md', 'writing'), /Denied/);
  assert.equal(repo.commits, 0); assert.equal(repo.calls.length, 1);
});
test('concurrent mutations are rejected', async () => {
  let resolve;
  const api = github(config, () => 'token', () => new Promise(done => resolve = done));
  const first = api.save('content/posts/a.md', 'a');
  await assert.rejects(api.save('content/posts/b.md', 'b'), /still running/);
  resolve(json({ content: { sha: 'one' } })); await first;
});
test('tree lists all allowed Markdown without fetching contents', async () => {
  const repo = repository();
  for (const path of ['content/about.md', 'content/posts/draft.md', 'content/private/secret.md', 'content/templates/post.md', 'content/image.png', 'other/file.md']) repo.files.set(path, { sha: 'one', text: '' });
  const list = await github(config, () => 'token', repo.request).list();
  assert.deepEqual(list.map(file => file.path), ['content/about.md', 'content/posts/draft.md']); assert.equal(repo.calls.length, 1);
});
test('truncated tree is rejected instead of displaying incomplete content', async () => {
  await assert.rejects(github(config, () => 'token', async () => json({ truncated: true, tree: [] })).list(), /too large/);
});
function memory() { const map = new Map(); return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) }; }
test('drafts are scoped to exact document, repository and branch, and survive reload', () => {
  const storage = memory(), store = draftStore(config, storage);
  store.save({ id: 'content/a.md', path: 'content/a.md', text: 'A', sha: 'sha-a' });
  store.save({ id: 'content/b.md', path: 'content/b.md', text: 'B', sha: 'sha-b' });
  store.save({ id: 'new:1', text: 'new' }); store.token('secret');
  const reload = draftStore(config, storage);
  assert.equal(reload.drafts['content/a.md'].text, 'A'); assert.equal(reload.drafts['content/b.md'].sha, 'sha-b');
  assert.equal(Object.keys(reload.drafts).length, 3);
  assert.equal(Object.keys(draftStore({ ...config, branch: 'other' }, storage).drafts).length, 0);
  reload.forget('content/a.md'); reload.token(null);
  assert.equal(Object.keys(reload.drafts).length, 2); assert.equal(reload.token(), null);
});
test('legacy draft migrates alongside remembered credential', () => {
  const storage = memory(), prefix = `duck:${config.repository}:${config.branch}:${config.contentDir}:`;
  storage.setItem(prefix + 'draft', 'old writing'); storage.setItem(prefix + 'token', 'remembered');
  const store = draftStore(config, storage);
  assert.equal(store.drafts.legacy.text, 'old writing'); assert.equal(store.token(), 'remembered'); assert.equal(storage.getItem(prefix + 'draft'), null);
});
test('blocked storage keeps drafts in memory and reports limitation', () => {
  let errors = 0;
  const blocked = { getItem() { throw Error(); }, setItem() { throw Error(); }, removeItem() { throw Error(); } };
  const store = draftStore(config, blocked, () => errors++);
  store.save({ id: 'new:1', text: 'keep writing' });
  assert.equal(store.drafts['new:1'].text, 'keep writing'); assert.ok(errors);
});
test('known publication status survives deployment delay and reload', () => {
  const storage = memory(), store = draftStore(config, storage);
  store.mark('content/post.md', { title: 'Title', draft: true }); store.mark('content/deleted.md', null);
  const reload = draftStore(config, storage);
  assert.equal(reload.known['content/post.md'].draft, true); assert.equal(reload.known['content/deleted.md'], null);
});
test('draft visibility changes preserve title, unknown metadata and body', () => {
  const text = '---\ntitle: "Title"\ntags: [one]\ncustom: yes\ndraft: false\n---\n\nBody 🦆';
  assert.equal(isDraft(text), false); assert.equal(isDraft(setDraft(text, true)), true);
  assert.equal(setDraft(setDraft(text, true), false), text);
});
test('new filenames use frontmatter, strip accents and apostrophes, reject empty slugs', () => {
  assert.equal(filename('---\ntitle: "João’s ideas! 🦆"\n---\n\n# Different heading'), 'joaos-ideas.md');
  assert.throws(() => filename('---\ntitle: "🦆 !!!"\n---\n\nBody'), /letters or numbers/);
  assert.throws(() => filename('---\ntitle: >\n  Multiline\n---\nBody'), /single-line/);
});
test('invalid storage shapes are recoverable and do not crash the editor', () => {
  for (const raw of ['null', '[]', '"string"', '{broken']) {
    const storage = memory(), key = `duck:${config.repository}:${config.branch}:${config.contentDir}:`;
    storage.setItem(key + 'drafts', raw);
    const store = draftStore(config, storage);
    store.save({ id: 'new:1', text: 'still writing' });
    assert.equal(store.drafts['new:1'].text, 'still writing');
    assert.equal(storage.getItem(key + 'drafts:recovery'), raw);
  }
});
test('failed legacy migration retains original even when an older drafts key already exists', () => {
  const storage = memory(), prefix = `duck:${config.repository}:${config.branch}:${config.contentDir}:`;
  storage.setItem(prefix + 'draft', 'latest writing');
  storage.setItem(prefix + 'drafts', JSON.stringify({ 'new:1': { id: 'new:1', text: 'older writing' } }));
  const blockedWrites = { ...storage, setItem() { throw new Error('Quota exceeded'); } };
  const store = draftStore(config, blockedWrites);
  assert.equal(store.drafts.legacy.text, 'latest writing');
  assert.equal(storage.getItem(prefix + 'draft'), 'latest writing');
});
test('GitHub refuses files outside content scope and unsupported encoded responses', async () => {
  let calls = 0;
  const api = github(config, () => 'token', async () => { calls++; return json({ type: 'file', encoding: 'none', content: '', sha: 'large' }); });
  await assert.rejects(api.save('.github/workflows/thing.md', 'unwanted'), /outside/);
  await assert.rejects(api.read('content/../README.md'), /outside/);
  assert.equal(calls, 0);
  await assert.rejects(api.read('content/posts/large.md'), /inline content limit/);
});
test('API timeouts preserve failure state and release the mutation guard', async () => {
  const api = github(config, () => 'token', (_url, { signal }) => new Promise((_resolve, reject) => {
    const timer = setTimeout(() => {}, 100);
    signal.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
  }), { timeout: 5 });
  await assert.rejects(api.save('content/posts/one.md', 'Body'), /abort|timeout/i);
  await assert.rejects(api.save('content/posts/one.md', 'Body'), /abort|timeout/i);
});

test('invalid UTF-8 and BOM files are rejected without changing their bytes', async () => {
  for (const bytes of [Buffer.from([0xff]), Buffer.from('\uFEFF---\ntitle: Title\n---\nBody')]) {
    const api = github(config, () => 'token', async () => json({ type: 'file', encoding: 'base64', content: bytes.toString('base64'), sha: 'one' }));
    await assert.rejects(api.read('content/posts/one.md'), /encoded data|byte order mark/i);
  }
});
