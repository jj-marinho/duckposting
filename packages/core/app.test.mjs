import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { mountDuckposting } from './app.js';
import { draftStore } from './storage.js';
const config = { repository: 'test/blog', branch: 'main', contentRoot: 'notes', contentDir: 'notes/posts', index: '/index.json' };
const prefix = `duck:${config.repository}:${config.branch}:${config.contentDir}:`;
const text = title => `---\ntitle: "${title}"\ndraft: false\n---\n\nBody`;
const json = (data, status = 200) => new Response(JSON.stringify(data), { status });
const settle = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)); };
function memory() { const map = new Map(); return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) }; }
async function fixture({ storage = memory(), createEditor, deniedRead = false, deniedWrite = false } = {}) {
  const { window, document } = parseHTML('<html><body><main id="app"></main></body></html>');
  globalThis.document = document;
  // linkedom has no browser focus manager; record focus transitions explicitly.
  let active = document.body;
  Object.defineProperty(document, 'activeElement', { get: () => active });
  window.HTMLElement.prototype.focus = function () { active = this; };
  const root = document.querySelector('main');
  const files = new Map(['a', 'b'].map(name => [`notes/posts/${name}.md`, { text: text(name.toUpperCase()), sha: name }]));
  const calls = [];
  const request = async (url, options = {}) => {
    calls.push({ url, ...options });
    if (url === '/index.json') return json([...files].map(([path, file]) => ({ path, title: file.text.includes('"A"') ? 'A' : 'B' })));
    if (url.includes('/git/trees/')) return json({ tree: [...files].map(([path, file]) => ({ path, sha: file.sha, type: 'blob' })) });
    const path = decodeURIComponent(new URL(url).pathname.split('/contents/')[1]);
    const file = files.get(path);
    if (!options.method) return deniedRead || !file ? json({}, 404) : json({ content: Buffer.from(file.text).toString('base64'), sha: file.sha });
    if (deniedWrite) return json({ message: 'Denied' }, 403);
    const data = JSON.parse(options.body);
    if (options.method === 'DELETE') files.delete(path);
    else files.set(path, { text: Buffer.from(data.content, 'base64').toString(), sha: 'new' });
    return json({ content: files.get(path) || null });
  };
  const sessions = [];
  const fakeEditor = async (node, session, callbacks) => {
    node.textContent = session.text;
    sessions.push({ session, callbacks }); callbacks.onReady();
    return { async destroy() {}, setBusy() {}, focus() { node.focus(); } };
  };
  // Native <dialog> is exercised in browser; this DOM fixture keeps the same open/close contract.
  const mounted = mountDuckposting(root, config, { storage, request, createEditor: createEditor || fakeEditor });
  for (const dialog of root.querySelectorAll('dialog')) { dialog.showModal = () => dialog.open = true; dialog.close = () => dialog.open = false; }
  const destroy = await mounted; await settle();
  const click = async selector => { const node = root.querySelector(selector); node.focus(); node.dispatchEvent(new window.Event('click')); await settle(); };
  const cancel = async selector => { root.querySelector(selector).dispatchEvent(new window.Event('cancel', { cancelable: true })); await settle(); };
  return { root, storage, destroy, click, cancel, document, files, calls, sessions };
}
test('exact-document recovery offers local changes for A but not B; Publish changes only A', async () => {
  const storage = memory(); storage.setItem(prefix + 'token', 'fake');
  draftStore(config, storage).save({ id: 'notes/posts/a.md', path: 'notes/posts/a.md', sha: 'a', text: text('Local A') });
  const f = await fixture({ storage });
  try {
    await f.click('.duck-entry:nth-child(2) button');
    assert.equal(f.root.querySelector('#confirm-dialog').open, undefined); assert.equal(f.sessions[0].session.path, 'notes/posts/b.md');
    await f.click('#back'); await f.click('.duck-entry:nth-child(1) button');
    assert.equal(f.root.querySelector('#confirm-dialog').open, true);
    await f.click('#confirm-yes'); assert.equal(f.sessions[1].session.text, text('Local A'));
    await f.click('#publish');
    assert.equal(f.files.get('notes/posts/a.md').text, text('Local A')); assert.equal(f.files.get('notes/posts/b.md').text, text('B'));
    assert.equal(f.calls.filter(call => call.method === 'PUT').length, 1);
    assert.equal(draftStore(config, storage).drafts['notes/posts/a.md'], undefined);
  } finally { await f.destroy(); }
});
test('404 from a private/inaccessible repository cannot discard local changes on Delete', async () => {
  const storage = memory(); storage.setItem(prefix + 'token', 'wrong-repo-token');
  draftStore(config, storage).save({ id: 'notes/posts/a.md', path: 'notes/posts/a.md', sha: 'a', text: text('Keep this') });
  const f = await fixture({ storage, deniedRead: true });
  try {
    await f.click('.duck-entry:nth-child(1) button:last-child'); await f.click('#confirm-yes');
    assert.match(f.root.querySelector('#status').textContent, /Deletion not confirmed/);
    assert.equal(draftStore(config, storage).drafts['notes/posts/a.md'].text, text('Keep this'));
    assert.equal(f.calls.filter(call => call.method === 'DELETE').length, 0);
  } finally { await f.destroy(); }
});
test('mounting locks navigation; disposal invalidates old callbacks and destroys late editor', async () => {
  let finish, callbacks, destroyed = 0;
  const f = await fixture({ createEditor: async (_root, _session, current) => {
    callbacks = current; await new Promise(resolve => finish = resolve);
    return { async destroy() { destroyed++; }, setBusy() {} };
  } });
  await f.click('#new');
  assert.equal(f.root.querySelector('#back').disabled, true);
  await f.click('#back'); assert.equal(f.root.querySelector('#editor').hidden, false);
  await f.destroy(); callbacks.onChange(text('Late data')); callbacks.onReady(); finish(); await settle();
  assert.equal(destroyed, 1); assert.equal(Object.keys(draftStore(config, f.storage).drafts).length, 0);
});
test('initial fetch can be aborted immediately when the writer is removed', async () => {
  const { document } = parseHTML('<main></main>'); globalThis.document = document;
  let pendingSignal;
  const destroy = await mountDuckposting(document.querySelector('main'), config, { storage: memory(), request: (_url, { signal }) => {
    pendingSignal = signal;
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
  } });
  for (const dialog of document.querySelectorAll("dialog")) dialog.close = () => {};
  await destroy(); assert.equal(pendingSignal.aborted, true);
});

test('Escape cancels exact-document recovery without loading repository and restores its Edit button', async () => {
  const storage = memory(); storage.setItem(prefix + 'token', 'fake');
  draftStore(config, storage).save({ id: 'notes/posts/a.md', path: 'notes/posts/a.md', sha: 'a', text: text('Keep local A') });
  const f = await fixture({ storage });
  try {
    const trigger = f.root.querySelector('.duck-entry button');
    await f.click('.duck-entry button');
    assert.equal(f.root.querySelector('#confirm-dialog').open, true);
    await f.cancel('#confirm-dialog');
    assert.equal(f.root.querySelector('#confirm-dialog').open, false);
    assert.equal(f.document.activeElement, trigger);
    assert.equal(f.sessions.length, 0);
    assert.equal(f.calls.filter(call => call.url.includes('/contents/')).length, 0);
    assert.equal(draftStore(config, storage).drafts['notes/posts/a.md'].text, text('Keep local A'));
    // A later recovery remains operable; the cancelled promise/listeners were cleaned up.
    await f.click('.duck-entry button'); await f.click('#confirm-yes');
    assert.equal(f.sessions.length, 1);
    assert.equal(f.document.activeElement, f.root.querySelector('#editor'));
  } finally { await f.destroy(); }
});

test('Escape cancels Delete, defaults focus to Cancel, and never sends a mutation', async () => {
  const storage = memory(); storage.setItem(prefix + 'token', 'fake');
  const f = await fixture({ storage });
  try {
    const trigger = f.root.querySelector('.duck-entry button:last-child');
    await f.click('.duck-entry button:last-child');
    assert.equal(f.document.activeElement, f.root.querySelector('#confirm-no'));
    await f.cancel('#confirm-dialog');
    assert.equal(f.document.activeElement, trigger);
    assert.equal(f.calls.filter(call => call.method).length, 0);
    assert.equal(f.files.size, 2);
  } finally { await f.destroy(); }
});

test('draft picker Escape returns to New Post, and editor/back move keyboard focus', async () => {
  const storage = memory(); draftStore(config, storage).save({ id: 'new:one', text: text('Local') });
  const f = await fixture({ storage });
  try {
    await f.click('#new');
    assert.equal(f.document.activeElement, f.root.querySelector('#choices button'));
    await f.cancel('#draft-picker');
    assert.equal(f.root.querySelector('#draft-picker').open, false);
    assert.equal(f.document.activeElement, f.root.querySelector('#new'));
    await f.click('#new'); await f.click('#start-new');
    assert.equal(f.document.activeElement, f.root.querySelector('#editor'));
    await f.click('#back');
    assert.equal(f.document.activeElement, f.root.querySelector('#new'));
  } finally { await f.destroy(); }
});

test('closing the writer while a restore dialog is open cancels its pending choice', async () => {
  const storage = memory(); storage.setItem(prefix + 'token', 'fake');
  draftStore(config, storage).save({ id: 'notes/posts/a.md', path: 'notes/posts/a.md', sha: 'a', text: text('Keep A') });
  const f = await fixture({ storage });
  await f.click('.duck-entry button');
  assert.equal(f.root.querySelector('#confirm-dialog').open, true);
  await f.destroy(); await settle();
  assert.equal(f.root.querySelector('#confirm-dialog').open, false);
  assert.equal(f.sessions.length, 0);
  assert.equal(f.calls.filter(call => call.url.includes('/contents/')).length, 0);
  assert.equal(draftStore(config, storage).drafts['notes/posts/a.md'].text, text('Keep A'));
});

test('denied image uploads preserve exact-document writing and release Publish', async () => {
  const storage = memory(); storage.setItem(prefix + 'token', 'fake');
  const f = await fixture({ storage, deniedWrite: true });
  try {
    await f.click('.duck-entry:nth-child(1) button');
    const callbacks = f.sessions[0].callbacks;
    callbacks.onChange(text('Keep my writing'));
    await assert.rejects(callbacks.uploadImage(new File(['image bytes'], 'photo.png')), /Denied/);
    assert.equal(draftStore(config, storage).drafts['notes/posts/a.md'].text, text('Keep my writing'));
    assert.equal(f.root.querySelector('#publish').disabled, false);
    assert.match(f.root.querySelector('#status').textContent, /writing is kept/);
  } finally { await f.destroy(); }
});
test('closed editor image callbacks cannot commit files', async () => {
  const storage = memory(); storage.setItem(prefix + 'token', 'fake');
  const f = await fixture({ storage });
  try {
    await f.click('.duck-entry:nth-child(1) button');
    const callbacks = f.sessions[0].callbacks;
    await f.click('#back');
    await assert.rejects(callbacks.uploadImage(new File(['bytes'], 'photo.png')), /closed/);
    assert.equal(f.calls.filter(call => call.method === 'PUT').length, 0);
  } finally { await f.destroy(); }
});
