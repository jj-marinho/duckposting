import { mountEditor } from './editor.js';
import { filename, readTitle, splitDocument, isDraft } from './document.js';
import { github } from './github.js';
import { draftStore } from './storage.js';

export async function mountDuckposting(root, options, dependencies = {}) {
  const { request = fetch } = dependencies;
  let storage;
  try { storage = dependencies.storage ?? localStorage; } catch { /* In-memory writing still works. */ }
  const config = { branch: 'main', contentDir: 'content/posts', contentRoot: 'content', exclude: [],
    template: '---\ntitle: ""\ndate: {{date}}\ndraft: false\n---\n\n', ...options };
  for (const path of [config.contentRoot, config.contentDir]) {
    if (!path || path.startsWith('/') || path.split('/').some(part => ['.', '..', ''].includes(part))) throw new Error('Content paths must be repository-relative directories.');
  }
  root.classList.add('duckposting');
  root.innerHTML = `
    <div class="duck-toolbar"><button id="back" hidden>← All content</button><button id="new">+ New Post</button></div>
    <section id="index"><h1>Content</h1><div id="entries"></div></section>
    <div id="editor" hidden></div>
    <div class="duck-controls"><div class="duck-actions">
      <button id="publish" hidden disabled>Publish</button>
      <details id="connection"><summary aria-label="GitHub connection" title="GitHub connection">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M12 .7a11.5 11.5 0 0 0-3.64 22.41c.57.11.79-.25.79-.56v-2.2c-3.2.7-3.87-1.36-3.87-1.36-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.33.95.1-.74.4-1.24.73-1.53-2.56-.29-5.25-1.28-5.25-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.16 1.18a11 11 0 0 1 5.76 0c2.19-1.49 3.16-1.18 3.16-1.18.62 1.59.23 2.76.11 3.05.73.81 1.18 1.83 1.18 3.09 0 4.42-2.7 5.39-5.27 5.67.41.36.78 1.06.78 2.13v3.23c0 .31.21.68.79.56A11.5 11.5 0 0 0 12 .7Z"/></svg>
      </summary><div class="duck-connection">
        <label for="token">Personal access token</label><input id="token" type="password" autocomplete="off" spellcheck="false">
        <label><input id="remember" type="checkbox"> Remember on this device</label>
        <button id="connect">Connect</button> <button id="forget">Forget</button>
      </div></details>
    </div><p id="status" role="status" aria-live="polite"></p>
    <p id="storage-warning" role="status" hidden>Local saving is unavailable. Keep this tab open to preserve your writing.</p></div>
    <dialog id="draft-picker"><h2>Continue a draft?</h2><div id="choices"></div>
      <button id="start-new">Start a new post</button> <button id="cancel-picker">Cancel</button></dialog>
    <dialog id="confirm-dialog"><h2 id="confirm-title"></h2><p id="confirm-description"></p>
      <button id="confirm-yes"></button> <button id="confirm-no"></button></dialog>`;
  const get = id => root.querySelector(`#${id}`);
  const controller = new AbortController(), { signal } = controller;
  const on = (node, event, fn) => node.addEventListener(event, fn, { signal });
  const store = draftStore(config, storage, () => get('storage-warning').hidden = false);
  const token = get('token');
  token.value = store.token() || '';
  get('remember').checked = Boolean(token.value);
  const api = github(config, () => token.value.trim(), request);
  let published = [], files = null, session, editor, busy = false, ready = false, disposed = false;
  const status = text => { if (!disposed) get('status').textContent = text; };
  const titleOf = text => { try { return readTitle(text) || 'Untitled'; } catch { return 'Untitled'; } };
  const entries = () => {
    const metadata = new Map(published.map(entry => [entry.path, entry]));
    for (const [path, entry] of Object.entries(store.known)) {
      if (entry) metadata.set(path, entry); else metadata.delete(path);
    }
    return (files || [...metadata.values()]).map(file => ({
      title: file.path.split('/').pop().replace(/\.md$/i, '').replace(/[-_]/g, ' '), draft: true,
      ...file, ...metadata.get(file.path), path: file.path,
    })).sort((a, b) => a.title.localeCompare(b.title));
  };
  function button(label, fn, disabled = false) {
    const node = document.createElement('button');
    node.type = 'button'; node.textContent = label; node.disabled = disabled;
    node.addEventListener('click', fn, { signal });
    return node;
  }
  function renderIndex() {
    if (disposed) return;
    const list = get('entries'); list.replaceChildren();
    for (const entry of entries()) {
      const row = document.createElement('div'); row.className = 'duck-entry';
      const info = document.createElement('div'), title = document.createElement('strong'), detail = document.createElement('small');
      title.textContent = entry.title;
      const local = store.drafts[entry.path];
      detail.textContent = `${entry.draft ? 'Draft / unpublished' : 'Published'}${local ? ' · Local changes' : ''} · ${entry.path}`;
      info.append(title, detail);
      row.append(info, button('Edit', () => edit(entry), busy), button('Delete', () => remove(entry), busy || !token.value.trim()));
      list.append(row);
    }
    if (!list.children.length) list.textContent = 'No content yet. Start a post or connect GitHub to load repository drafts.';
    const count = Object.values(store.drafts).filter(draft => !draft.path).length;
    if (count) { const note = document.createElement('p'); note.textContent = `${count} local new-post draft${count === 1 ? '' : 's'}. Choose + New Post to continue writing.`; list.append(note); }
  }
  function updatePublish() {
    let valid = false;
    try { filename(session?.text || ''); valid = Boolean(splitDocument(session.text).body.trim()); } catch {}
    get('publish').disabled = busy || !ready || !valid || !token.value.trim() || config.repository === 'YOUR-USERNAME/YOUR-BLOG';
  }
  function setBusy(value) {
    busy = value;
    get('back').disabled = get('new').disabled = get('connect').disabled = get('forget').disabled = token.disabled = get('remember').disabled = value;
    editor?.setBusy(value); updatePublish(); renderIndex();
  }
  async function refresh() {
    if (!token.value.trim()) return;
    setBusy(true); status('Loading repository…');
    try { files = await api.list(); status(''); }
    catch (error) { status(`Could not load GitHub. ${error.message}`); }
    finally { setBusy(false); }
  }
  async function open(draft) {
    if (disposed) return;
    await editor?.destroy(); editor = undefined;
    session = { ...draft }; ready = false;
    get('index').hidden = get('new').hidden = true;
    get('editor').hidden = get('back').hidden = get('publish').hidden = false;
    status(''); updatePublish();
    editor = await mountEditor(get('editor'), session, {
      onChange(text) { session.text = text; store.save(session); updatePublish(); },
      onReady() { ready = true; updatePublish(); },
    });
    if (disposed) await editor.destroy();
  }
  async function back() {
    await editor?.destroy(); editor = undefined; session = undefined; ready = false;
    get('editor').hidden = get('back').hidden = get('publish').hidden = true;
    get('index').hidden = get('new').hidden = false; renderIndex();
  }
  function choose(title, description, yes, no) {
    const dialog = get('confirm-dialog');
    get('confirm-title').textContent = title; get('confirm-description').textContent = description;
    get('confirm-yes').textContent = yes; get('confirm-no').textContent = no;
    return new Promise(resolve => {
      const finish = value => { dialog.close(); cleanup(); resolve(value); };
      const accept = () => finish(true), decline = () => finish(false);
      const cleanup = () => { get('confirm-yes').removeEventListener('click', accept); get('confirm-no').removeEventListener('click', decline); dialog.removeEventListener('cancel', decline); };
      get('confirm-yes').addEventListener('click', accept, { signal }); get('confirm-no').addEventListener('click', decline, { signal }); dialog.addEventListener('cancel', decline, { signal });
      dialog.showModal();
    });
  }
  async function edit(entry) {
    if (busy) return;
    const local = store.drafts[entry.path];
    if (local && await choose('Resume local changes?', `Saved changes for “${titleOf(local.text)}”.`, 'Use local draft', 'Use repository version')) return open(local);
    if (!token.value.trim()) { get('connection').open = true; token.focus(); status('Connect GitHub to read the Markdown for this document.'); return; }
    setBusy(true);
    try { const file = await api.read(entry.path); await open({ id: entry.path, path: entry.path, ...file }); }
    catch (error) { status(`Could not open this document. ${error.message}`); }
    finally { setBusy(false); }
  }
  async function remove(entry) {
    if (busy || !token.value.trim() || !await choose(`Delete “${entry.title}”?`, 'This removes the file and its local changes. Earlier versions remain in Git history.', 'Delete post', 'Cancel')) return;
    setBusy(true); status('Deleting…');
    try {
      try {
        const file = await api.read(entry.path);
        await api.remove(entry.path, file.sha);
      } catch (error) { if (error.status !== 404) throw error; }
      store.forget(entry.path); store.mark(entry.path, null);
      files = (files || entries()).filter(file => file.path !== entry.path);
      status('Deleted from GitHub. The blog updates after its build finishes.');
    } catch (error) { status(`Deletion not confirmed. ${error.message} Local changes are kept.`); }
    finally { setBusy(false); }
  }
  on(get('new'), 'click', async () => {
    if (busy) return;
    if (token.value.trim()) await refresh();
    const choices = get('choices'); choices.replaceChildren();
    for (const draft of Object.values(store.drafts).filter(draft => !draft.path)) {
      const row = document.createElement('p'); row.append(button(`Local draft: ${titleOf(draft.text)}`, () => { get('draft-picker').close(); open(draft); })); choices.append(row);
    }
    for (const entry of entries().filter(entry => entry.draft)) {
      const row = document.createElement('p'); row.append(button(`Repository draft: ${entry.title}`, () => { get('draft-picker').close(); edit(entry); })); choices.append(row);
    }
    if (choices.children.length) get('draft-picker').showModal(); else startNew();
  });
  function startNew() {
    get('draft-picker').close();
    const now = new Date(), date = [now.getFullYear(), now.getMonth() + 1, now.getDate()].map(n => String(n).padStart(2, '0')).join('-');
    open({ id: `new:${crypto.randomUUID()}`, text: config.template.replaceAll('{{date}}', date) });
  }
  on(get('start-new'), 'click', startNew);
  on(get('cancel-picker'), 'click', () => get('draft-picker').close());
  on(get('back'), 'click', back);
  function saveToken() { store.token(get('remember').checked ? token.value.trim() : null); updatePublish(); renderIndex(); }
  on(token, 'input', saveToken); on(get('remember'), 'change', saveToken);
  on(get('connect'), 'click', async () => { saveToken(); await refresh(); get('connection').open = false; });
  on(get('forget'), 'click', () => { token.value = ''; get('remember').checked = false; files = null; saveToken(); });
  on(get('publish'), 'click', async () => {
    if (get('publish').disabled) return;
    const snapshot = { ...session };
    const path = snapshot.path || `${config.contentDir.replace(/\/$/, '')}/${filename(snapshot.text)}`;
    store.save(snapshot); setBusy(true); status('Publishing…');
    try {
      const result = await api.save(path, snapshot.text, snapshot.sha);
      store.forget(snapshot.id);
      const entry = { path, title: titleOf(snapshot.text), draft: isDraft(snapshot.text), sha: result.sha };
      store.mark(path, entry);
      if (files) files = [...files.filter(file => file.path !== path), entry];
      await back();
      status(entry.draft ? 'Draft saved to GitHub. It stays hidden from the blog.' : 'Published to GitHub. The blog updates after its build finishes.');
      const link = document.createElement('a'); link.textContent = ' View on GitHub';
      link.href = result.url || `https://github.com/${config.repository}/blob/${encodeURIComponent(config.branch)}/${path.split('/').map(encodeURIComponent).join('/')}`;
      link.target = '_blank'; link.rel = 'noopener noreferrer'; get('status').append(link);
    } catch (error) { status(`Publishing not confirmed. ${error.message} Your local draft is kept.`); }
    finally { setBusy(false); }
  });
  try {
    if (config.index) {
      const response = await request(config.index, { cache: 'no-store' });
      if (!response.ok) throw new Error();
      published = await response.json();
    }
  } catch { status('The published index is unavailable. Connect GitHub to list repository content.'); }
  renderIndex();
  if (token.value.trim()) await refresh();
  return async () => { disposed = true; controller.abort(); get('draft-picker').close(); get('confirm-dialog').close(); await editor?.destroy(); };
}
