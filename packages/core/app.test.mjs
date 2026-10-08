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
async function fixture({ storage = memory(), createEditor, deniedRead = false, deniedWrite = false, historyRequest, deniedVersion = false, options = {} } = {}) {
  const { window, document } = parseHTML('<html><body><main id="app"></main></body></html>');
  globalThis.document = document;
  // linkedom has no browser focus manager; record focus transitions explicitly.
  let active = document.body;
  Object.defineProperty(document, 'activeElement', { get: () => active });
  window.HTMLElement.prototype.focus = function () { active = this; };
  // linkedom exposes a select getter only; model native selection for the UI fixture.
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', { configurable: true,
    get() { return this.querySelector('option[selected]')?.value || this.querySelector('option')?.value || ''; },
    set(value) { for (const option of this.querySelectorAll('option')) option.selected = option.value === value; },
  });
  const root = document.querySelector('main');
  const files = new Map(['a', 'b'].map(name => [`notes/posts/${name}.md`, { text: text(name.toUpperCase()), sha: name }]));
  const calls = [];
  const request = async (url, options = {}) => {
    calls.push({ url, ...options });
    if (url === '/index.json') return json([...files].map(([path, file]) => ({ path, title: file.text.includes('"A"') ? 'A' : 'B' })));
    if (url.includes('/git/trees/')) return json({ tree: [...files].map(([path, file]) => ({ path, sha: file.sha, type: 'blob' })) });
    if (new URL(url).pathname.endsWith('/commits')) return historyRequest ? historyRequest(url) : json([{ sha: '1'.repeat(40), commit: { message: 'First version\n\nDetails', committer: { date: '2026-10-01T12:00:00Z' } } }]);
    const path = decodeURIComponent(new URL(url).pathname.split('/contents/')[1]);
    const file = files.get(path);
    const historical = new URL(url).searchParams.get('ref') === '1'.repeat(40);
    if (!options.method) return deniedRead || historical && deniedVersion || !file ? json({}, 404) : json({ content: Buffer.from(historical ? text('Older A') : file.text).toString('base64'), sha: historical ? 'historical-blob' : file.sha });
    if (deniedWrite) return json({ message: 'Denied' }, 403);
    const data = JSON.parse(options.body);
    if (options.method === 'DELETE') files.delete(path);
    else files.set(path, { text: Buffer.from(data.content, 'base64').toString(), sha: 'new' });
    return json({ content: files.get(path) || null });
  };
  const sessions = [];
  const fakeEditor = async (node, session, callbacks) => {
    node.textContent = session.text;
    node.append(callbacks.versionControl);
    sessions.push({ session, callbacks }); callbacks.onReady();
    return { async destroy() {}, setBusy() {}, focus() { node.focus(); } };
  };
  // Native <dialog> is exercised in browser; this DOM fixture keeps the same open/close contract.
  const mounted = mountDuckposting(root, { ...config, ...options }, { storage, request, createEditor: createEditor || fakeEditor });
  for (const dialog of root.querySelectorAll('dialog')) { dialog.showModal = () => dialog.open = true; dialog.close = () => dialog.open = false; }
  const destroy = await mounted; await settle();
  const click = async selector => { const node = root.querySelector(selector); node.focus(); node.dispatchEvent(new window.Event('click')); await settle(); };
  const cancel = async selector => { root.querySelector(selector).dispatchEvent(new window.Event('cancel', { cancelable: true })); await settle(); };
  const selectVersion = async value => { const select = root.querySelector('select[aria-label="Post versions"]'); select.value = value; select.dispatchEvent(new window.Event('change')); await settle(); };
  return { root, storage, destroy, click, cancel, selectVersion, document, files, calls, sessions };
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

test('initialPath opens the exact document and still offers recovery; missing paths leave the index usable', async () => {
  const storage = memory(); storage.setItem(prefix + 'token', 'fake');
  const path = 'notes/posts/a.md';
  let f = await fixture({ storage, options: { initialPath: path } });
  try { assert.equal(f.sessions[0].session.path, path); await f.click('#back'); assert.equal(f.root.querySelector('#index').hidden, false); }
  finally { await f.destroy(); }
  draftStore(config, storage).save({ id: path, path, sha: 'a', text: text('Recovered') });
  f = await fixture({ storage, options: { initialPath: path } });
  try {
    assert.equal(f.sessions.length, 0); assert.equal(f.root.querySelector('#confirm-dialog').open, true);
    await f.click('#confirm-yes'); assert.equal(f.sessions[0].session.text, text('Recovered'));
  } finally { await f.destroy(); }
  f = await fixture({ storage, options: { initialPath: 'notes/missing.md' } });
  try { assert.equal(f.sessions.length, 0); assert.equal(f.root.querySelector('#index').hidden, false); }
  finally { await f.destroy(); }
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

test('local new-post drafts appear above pages; New Post starts fresh and Edit resumes the selected draft', async () => {
  const storage = memory(); draftStore(config, storage).save({ id: 'new:one', text: text('Local') });
  const f = await fixture({ storage });
  try {
    assert.equal(f.root.querySelector('.duck-entry').dataset.path, 'new:one');
    assert.equal(f.root.querySelector('.duck-draft-label').textContent, 'Local draft');
    await f.click('#new');
    assert.notEqual(f.sessions.at(-1).session.id, 'new:one');
    assert.equal(f.document.activeElement, f.root.querySelector('#editor'));
    await f.click('#back');
    assert.equal(f.document.activeElement, f.root.querySelector('#new'));
    await f.click('.duck-entry button');
    assert.equal(f.sessions.at(-1).session.id, 'new:one');
    assert.equal(f.sessions.at(-1).session.text, text('Local'));
    await f.click('#back'); await f.click('.duck-entry button:nth-of-type(2)'); await f.cancel('#confirm-dialog');
    assert(draftStore(config, storage).drafts['new:one']);
    await f.click('.duck-entry button:nth-of-type(2)'); await f.click('#confirm-yes');
    assert.equal(draftStore(config, storage).drafts['new:one'], undefined);
    assert.equal(f.root.querySelector('.duck-draft-label'), null);
    assert.equal(f.calls.filter(call => call.method).length, 0);
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
test('page picker reuses the scoped catalog and excludes the current page without fetching contents', async () => {
  const storage = memory(); storage.setItem(prefix + 'token', 'fake');
  const f = await fixture({ storage });
  try {
    await f.click('.duck-entry:nth-child(1) button');
    const calls = f.calls.length;
    const pages = f.sessions[0].callbacks.getPages();
    assert.deepEqual(pages.map(page => [page.title, page.href]), [['B', 'posts/b.md']]);
    assert.equal(f.calls.length, calls);
  } finally { await f.destroy(); }
});

test('builder URLs survive edits, new links wait for rebuilt routes and native draft flags reach Publish', async () => {
  const storage = memory(); storage.setItem(prefix + 'token', 'fake');
  const f = await fixture({ storage, options: { published: [{ path: 'notes/posts/a.md', title: 'A', url: '/project/custom/a/' }, { path: 'notes/posts/b.md', title: 'B', url: '/project/custom/b/' }], publishedLinksOnly: true, draftField: 'published', draftValue: false, filenameFormat: 'date-title' } });
  try {
    await f.click('.duck-entry:nth-child(1) button');
    assert.equal(f.sessions[0].callbacks.getPages()[0].href, '/project/custom/b/');
    assert.equal(f.sessions[0].callbacks.config.draftField, 'published');
    f.sessions[0].callbacks.onChange('---\ntitle: Edited\npublished: false\n---\n\nBody');
    await f.click('#publish');
    assert.match(f.root.querySelector('#status').textContent, /Draft saved/);
    await f.click('#new');
    const current = f.sessions.at(-1).callbacks;
    current.onChange('---\ntitle: New entry\ndate: 2026-10-07\npublished: true\n---\n\nBody');
    await f.click('#publish');
    assert(f.files.has('notes/posts/2026-10-07-new-entry.md'));
    await f.click('.duck-entry:nth-child(1) button');
    const pages = f.sessions.at(-1).callbacks.getPages();
    assert(!pages.some(page => page.title === 'New entry'), 'Do not guess a new host route before rebuild');
    assert(!pages.some(page => page.title === 'Edited'), 'Native repository draft is not linkable');
  } finally { await f.destroy(); }
});

test('separate upload roots save one image with public Markdown URLs, keeping local recovery', async () => {
  const storage = memory(); storage.setItem(prefix + 'token', 'fake');
  const f = await fixture({ storage, options: { imageDir: 'public/images', imageBase: '/project/images/' } });
  try {
    await f.click('.duck-entry:nth-child(1) button');
    const callbacks = f.sessions[0].callbacks;
    callbacks.onChange(text('Keep writing'));
    const reference = await callbacks.uploadImage(new File(['fake raster bytes'], 'photo.png'));
    assert.match(reference, /^\/project\/images\/photo-[\w-]+\.png$/);
    const call = f.calls.find(call => call.method === 'PUT');
    assert.match(call.url, /\/contents\/public\/images\/photo-/);
    assert.equal(JSON.parse(call.body).sha, undefined);
    assert.equal(f.calls.filter(call => call.method === 'PUT').length, 1);
    assert.equal(draftStore(config, storage).drafts['notes/posts/a.md'].text, text('Keep writing'));
  } finally { await f.destroy(); }
});

test('history previews keep the exact draft; restoring uses the current blob SHA and publishes once', async () => {
  const storage = memory(); storage.setItem(prefix + 'token', 'fake');
  const path = 'notes/posts/a.md', store = draftStore(config, storage);
  store.save({ id: path, path, sha: 'a', text: text('My draft') });
  const f = await fixture({ storage });
  try {
    await f.click('.duck-entry button'); await f.click('#confirm-yes');
    await f.selectVersion('1'.repeat(40));
    assert.equal(f.sessions.at(-1).callbacks.readOnly, true);
    assert.equal(f.sessions.at(-1).session.text, text('Older A'));
    assert.equal(f.root.querySelector('#publish').disabled, true);
    f.sessions.at(-1).callbacks.onChange(text('Ignored preview edit'));
    await assert.rejects(f.sessions.at(-1).callbacks.uploadImage(new File(['bytes'], 'photo.png')), /current writing/);
    assert.equal(draftStore(config, storage).drafts[path].text, text('My draft'));
    await f.selectVersion('working');
    assert.equal(f.sessions.at(-1).session.text, text('My draft'));
    assert.equal(f.root.querySelector('#publish').disabled, false);
    await f.selectVersion('1'.repeat(40));
    await f.click('.duck-versions button'); await f.click('#confirm-no');
    assert.equal(draftStore(config, storage).drafts[path].text, text('My draft'));
    await f.click('.duck-versions button'); await f.click('#confirm-yes');
    assert.equal(f.sessions.at(-1).callbacks.readOnly, false);
    assert.equal(draftStore(config, storage).drafts[path].text, text('Older A'));
    assert.equal(f.sessions.at(-1).session.sha, 'a');
    assert.equal(f.files.get(path).text, text('A'));
    await f.click('#publish');
    const writes = f.calls.filter(call => call.method === 'PUT');
    assert.equal(writes.length, 1); assert.equal(JSON.parse(writes[0].body).sha, 'a');
    assert.equal(f.files.get(path).text, text('Older A'));
    assert.equal(f.files.get('notes/posts/b.md').text, text('B'));
  } finally { await f.destroy(); }
});

test('browsing commits without edits never creates a draft; read failures keep the editor usable', async () => {
  const storage = memory(); storage.setItem(prefix + 'token', 'fake');
  let f = await fixture({ storage });
  try {
    await f.click('.duck-entry button'); await f.selectVersion('1'.repeat(40)); await f.selectVersion('working');
    assert.equal(Object.keys(draftStore(config, storage).drafts).length, 0);
    assert.equal(f.calls.filter(call => call.method).length, 0);
  } finally { await f.destroy(); }
  f = await fixture({ storage, deniedVersion: true });
  try {
    await f.click('.duck-entry button'); f.sessions.at(-1).callbacks.onChange(text('Kept'));
    await f.selectVersion('1'.repeat(40));
    assert.equal(f.root.querySelector('select').value, 'working');
    assert.equal(f.root.querySelector('#publish').disabled, false);
    assert.equal(draftStore(config, storage).drafts['notes/posts/a.md'].text, text('Kept'));
    assert.match(f.root.querySelector('#status').textContent, /Could not open this version/);
  } finally { await f.destroy(); }
});

test('repository version keeps a separate local draft available; discard only clears the exact document after a successful read', async () => {
  const storage = memory(); storage.setItem(prefix + 'token', 'fake');
  const a = 'notes/posts/a.md', b = 'notes/posts/b.md';
  const store = draftStore(config, storage);
  store.save({ id: a, path: a, sha: 'a', text: text('Local A') });
  store.save({ id: b, path: b, sha: 'b', text: text('Local B') });
  let f = await fixture({ storage });
  try {
    await f.click('.duck-entry[data-path="notes/posts/a.md"] button'); await f.click('#confirm-no');
    assert.equal(f.sessions.at(-1).session.text, text('A'));
    assert(f.root.querySelector('option[value="draft"]'));
    await f.selectVersion('draft'); assert.equal(f.sessions.at(-1).session.text, text('Local A'));
    await f.click('#back'); await f.click('.duck-entry[data-path="notes/posts/a.md"] button'); await f.click('#confirm-extra');
    assert.equal(f.sessions.at(-1).session.text, text('A'));
    assert.equal(draftStore(config, storage).drafts[a], undefined);
    assert.equal(draftStore(config, storage).drafts[b].text, text('Local B'));
  } finally { await f.destroy(); }
  store.save({ id: a, path: a, sha: 'a', text: text('Keep on failure') });
  f = await fixture({ storage, deniedRead: true });
  try {
    await f.click('.duck-entry[data-path="notes/posts/a.md"] button'); await f.click('#confirm-extra');
    assert.equal(draftStore(config, storage).drafts[a].text, text('Keep on failure'));
    assert.equal(f.sessions.length, 0);
  } finally { await f.destroy(); }
});

test('history pagination is explicit; denied history and late responses cannot replace writing', async () => {
  const storage = memory(); storage.setItem(prefix + 'token', 'fake');
  const commit = { sha: '1'.repeat(40), commit: { message: 'First', committer: { date: '2026-10-01T12:00:00Z' } } };
  let f = await fixture({ storage, historyRequest: url => json(new URL(url).searchParams.get('page') === '1' ? Array.from({length:30}, (_, index) => ({ ...commit, sha: (index + 1).toString(16).padStart(40, '0') })) : [commit]) });
  try {
    await f.click('.duck-entry button');
    assert.equal(f.calls.filter(call => call.url.includes('/commits?')).length, 1);
    await f.selectVersion('more');
    assert.equal(f.calls.filter(call => call.url.includes('/commits?')).length, 2);
    assert.equal(f.root.querySelector('option[value="more"]'), null);
  } finally { await f.destroy(); }
  f = await fixture({ storage, historyRequest: () => json({message:'Denied'},403) });
  try {
    await f.click('.duck-entry button');
    assert.match(f.root.querySelector('#status').textContent, /Could not load commit history/);
    assert.equal(f.root.querySelector('#publish').disabled, false);
    await f.selectVersion('more');
    assert.equal(f.calls.filter(call => call.url.includes('/commits?')).length, 2);
  } finally { await f.destroy(); }
  let finish;
  f = await fixture({ storage, historyRequest: () => new Promise(resolve => finish = resolve) });
  await f.click('.duck-entry button'); await f.click('#back');
  finish(json([commit])); await settle();
  assert.equal(f.root.querySelector('#index').hidden, false);
  assert.equal(f.root.querySelector('#status').textContent, '');
  await f.destroy();
});
