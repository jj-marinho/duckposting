import { pageHref } from './commands.js';
import { filename, readTitle, splitDocument, isDraft } from './document.js';
import { github } from './github.js';
import { draftStore } from './storage.js';
import { configuration } from './config.js';
import { contentEntries, publishedIndex } from './catalog.js';
import { imagePath, imageTarget } from './images.js';

export async function mountDuckposting(root, options, dependencies = {}) {
  const { request = fetch } = dependencies;
  let storage;
  try { storage = dependencies.storage ?? localStorage; } catch { /* In-memory writing still works. */ }
  const config = configuration(options);
  const createEditor = dependencies.createEditor ?? (async (...args) => (await import('./editor.js')).mountEditor(...args));
  root.classList.add('duckposting');
  root.innerHTML = `
    <div class="duck-toolbar"><button id="new">+ New Post</button></div>
    <section id="index"><h1>Content</h1><div id="entries"></div></section>
    <div id="editor" hidden></div>
    <div class="duck-controls"><div class="duck-publish-row">
      <button id="back" hidden>← All content</button><div class="duck-actions">
      <button id="publish" hidden disabled>Publish</button>
      <details id="connection"><summary aria-label="GitHub connection" title="GitHub connection">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M12 .7a11.5 11.5 0 0 0-3.64 22.41c.57.11.79-.25.79-.56v-2.2c-3.2.7-3.87-1.36-3.87-1.36-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.33.95.1-.74.4-1.24.73-1.53-2.56-.29-5.25-1.28-5.25-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.16 1.18a11 11 0 0 1 5.76 0c2.19-1.49 3.16-1.18 3.16-1.18.62 1.59.23 2.76.11 3.05.73.81 1.18 1.83 1.18 3.09 0 4.42-2.7 5.39-5.27 5.67.41.36.78 1.06.78 2.13v3.23c0 .31.21.68.79.56A11.5 11.5 0 0 0 12 .7Z"/></svg>
      </summary><div class="duck-connection">
        <label for="token">Personal access token</label><input id="token" type="password" autocomplete="off" spellcheck="false">
        <label><input id="remember" type="checkbox"> Remember on this device</label>
        <button id="connect">Connect</button> <button id="forget">Forget</button>
      </div></details>
    </div></div><p id="status" role="status" aria-live="polite"></p>
    <p id="storage-warning" role="status" hidden>Some local data could not be read or saved. Copy your writing before closing this tab.</p></div>
    <dialog id="draft-picker" aria-labelledby="draft-picker-title"><h2 id="draft-picker-title">Continue a draft?</h2><div id="choices"></div>
      <button id="start-new">Start a new post</button> <button id="cancel-picker">Cancel</button></dialog>
    <dialog id="confirm-dialog" aria-labelledby="confirm-title" aria-describedby="confirm-description"><h2 id="confirm-title"></h2><p id="confirm-description"></p>
      <button id="confirm-yes"></button> <button id="confirm-no"></button></dialog>`;
  const get = id => root.querySelector(`#${id}`);
  const controller = new AbortController(), { signal } = controller;
  const on = (node, event, fn) => node.addEventListener(event, async event => {
    if (disposed) return;
    try { await fn(event); } catch (error) { status(error.message); }
  }, { signal });
  const store = draftStore(config, storage, () => get('storage-warning').hidden = false);
  const token = get('token');
  token.value = store.token() || '';
  get('remember').checked = Boolean(token.value);
  const api = github(config, () => token.value.trim(), request, { signal });
  const imageCache = new Map(), imageURLs = new Set();
  let published = [], files = null, session, editor, busy = false, ready = false, disposed = false, viewTicket = 0, focusIndex = false;
  const status = text => { if (!disposed) get('status').textContent = text; };
  const titleOf = text => { try { return readTitle(text) || 'Untitled'; } catch { return 'Untitled'; } };
  const entries = () => contentEntries(config, published, files, store);
  function button(label, fn, disabled = false) {
    const node = document.createElement('button');
    node.type = 'button'; node.textContent = label; node.disabled = disabled;
    on(node, 'click', fn);
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
    try {
      const title = readTitle(session?.text || '');
      if (!session?.path) filename(session?.text || '', config);
      valid = Boolean(title.trim()) && !/[\r\n]/.test(title) && Boolean(splitDocument(session.text).body.trim());
      isDraft(session.text, config);
    } catch {}
    get('publish').disabled = busy || !ready || !valid || !token.value.trim() || config.repository === 'YOUR-USERNAME/YOUR-BLOG';
  }
  function setBusy(value) {
    if (disposed) return;
    busy = value;
    get('back').disabled = get('new').disabled = get('connect').disabled = get('forget').disabled = token.disabled = get('remember').disabled = value;
    editor?.setBusy(value); updatePublish(); renderIndex();
    if (!value && focusIndex) { focusIndex = false; get('new').focus(); }
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
    const ticket = ++viewTicket, current = { ...draft }, previous = editor;
    editor = undefined; session = current; ready = false;
    setBusy(true);
    get('index').hidden = get('new').hidden = true;
    get('editor').hidden = get('back').hidden = get('publish').hidden = false;
    status(''); updatePublish();
    try {
      await previous?.destroy();
      if (disposed || ticket !== viewTicket) return;
      const mounted = await createEditor(get('editor'), current, {
        config,
        onChange(text) {
          if (disposed || ticket !== viewTicket) return;
          current.text = text; store.save(current); updatePublish();
        },
        onReady() {},
        getPages: () => entries().filter(entry => entry.path !== current.path && (!config.publishedLinksOnly || !entry.draft && entry.url)).map(entry => ({ ...entry, href: entry.url || pageHref(entry.path, config.contentRoot) })),
        async imageSource(src) {
          const target = imageTarget(config, src, current.path, [...api.imagePaths, ...imageCache.keys()]);
          if (!target.path || !token.value.trim()) return target.url;
          if (!imageCache.has(target.path)) imageCache.set(target.path, api.readImage(target.path).then(blob => {
            if (disposed) throw new Error('Editor closed.');
            const url = URL.createObjectURL(blob); imageURLs.add(url); return url;
          }).catch(() => { imageCache.delete(target.path); return target.url; }));
          return imageCache.get(target.path);
        },
        async uploadImage(file) {
          if (disposed || ticket !== viewTicket) throw new Error('Editor closed.');
          if (busy) throw new Error('Another action is still running.');
          if (!token.value.trim()) throw new Error('Connect GitHub before uploading an image.');
          const path = imagePath(config, file);
          setBusy(true); status('Uploading image…');
          try {
            await api.saveImage(path, new Uint8Array(await file.arrayBuffer()));
            if (disposed) throw new Error('Editor closed.');
            const url = URL.createObjectURL(file); imageURLs.add(url); imageCache.set(path, Promise.resolve(url));
            status('Image saved to GitHub. Publish the post when ready.');
            return config.imageBase ? config.imageBase + path.slice(config.imageDir.length + 1).split('/').map(encodeURIComponent).join('/') : path.slice(config.contentRoot.length + 1);
          } catch (error) { status(`Image upload not confirmed. ${error.message} Your writing is kept.`); throw error; }
          finally { setBusy(false); }
        },
      });
      if (disposed || ticket !== viewTicket) { await mounted.destroy(); return; }
      editor = mounted; ready = true;
    } finally { if (!disposed && ticket === viewTicket) setBusy(false); }
    if (!disposed && ticket === viewTicket) editor?.focus?.();
  }
  async function back() {
    ++viewTicket;
    const previous = editor;
    editor = undefined; session = undefined; ready = false;
    await previous?.destroy();
    if (disposed) return;
    get('editor').hidden = get('back').hidden = get('publish').hidden = true;
    get('index').hidden = get('new').hidden = false; renderIndex();
    if (busy) focusIndex = true; else get('new').focus();
  }
  function choose(title, description, yes, no) {
    const dialog = get('confirm-dialog');
    const trigger = root.ownerDocument.activeElement;
    get('confirm-title').textContent = title; get('confirm-description').textContent = description;
    get('confirm-yes').textContent = yes; get('confirm-no').textContent = no;
    return new Promise(resolve => {
      let finished = false;
      const finish = value => {
        if (finished) return;
        finished = true; cleanup(); dialog.close();
        if (!disposed && trigger?.isConnected) trigger.focus();
        resolve(value);
      };
      const accept = () => finish(true), decline = () => finish(false);
      const cancel = event => { event.preventDefault?.(); finish(null); };
      const cleanup = () => { get('confirm-yes').removeEventListener('click', accept); get('confirm-no').removeEventListener('click', decline); dialog.removeEventListener('cancel', cancel); dialog.removeEventListener('close', cancel); signal.removeEventListener('abort', cancel); };
      get('confirm-yes').addEventListener('click', accept, { signal }); get('confirm-no').addEventListener('click', decline, { signal }); dialog.addEventListener('cancel', cancel, { signal }); dialog.addEventListener('close', cancel, { signal });
      signal.addEventListener('abort', cancel, { once: true });
      dialog.showModal();
      get('confirm-no').focus();
    });
  }
  async function edit(entry) {
    if (busy) return;
    const local = store.drafts[entry.path];
    if (local) {
      const choice = await choose('Resume local changes?', `Saved changes for “${titleOf(local.text)}”.`, 'Use local draft', 'Use repository version');
      if (choice === null) return;
      if (choice) return open(local);
    }
    if (disposed) return;
    if (!token.value.trim()) { get('connection').open = true; token.focus(); status('Connect GitHub to read the Markdown for this document.'); return; }
    setBusy(true);
    try { const file = await api.read(entry.path); await open({ id: entry.path, path: entry.path, ...file }); }
    catch (error) { status(`Could not open this document. ${error.message}`); }
    finally { setBusy(false); }
  }
  async function remove(entry) {
    if (busy || !token.value.trim() || !await choose(`Delete “${entry.title}”?`, 'This removes the file and its local changes. Earlier versions remain in Git history.', 'Delete post', 'Cancel')) return;
    if (disposed) return;
    setBusy(true); status('Deleting…');
    try {
      const file = await api.read(entry.path);
      await api.remove(entry.path, file.sha);
      if (disposed) return;
      store.forget(entry.path); store.mark(entry.path, null);
      files = (files || entries()).filter(file => file.path !== entry.path);
      status('Deleted from GitHub. The blog updates after its build finishes.');
      focusIndex = true;
    } catch (error) { status(`Deletion not confirmed. ${error.message} Local changes are kept.`); }
    finally { setBusy(false); }
  }
  on(get('new'), 'click', async () => {
    if (busy) return;
    if (token.value.trim()) await refresh();
    if (disposed) return;
    const choices = get('choices'); choices.replaceChildren();
    for (const draft of Object.values(store.drafts).filter(draft => !draft.path)) {
      const row = document.createElement('p');
      row.append(button(`Local draft: ${titleOf(draft.text)}`, () => { get('draft-picker').close(); return open(draft); }),
        button('Discard', async () => {
          get('draft-picker').close();
          if (await choose('Discard this local draft?', 'This only removes the browser copy. No GitHub file is changed.', 'Discard draft', 'Cancel')) store.forget(draft.id);
          renderIndex();
          get('new').focus();
        })); choices.append(row);
    }
    for (const entry of entries().filter(entry => entry.draft)) {
      const row = document.createElement('p'); row.append(button(`Repository draft: ${entry.title}`, () => { get('draft-picker').close(); edit(entry); })); choices.append(row);
    }
    if (choices.children.length) {
      get('draft-picker').showModal();
      choices.querySelector('button').focus();
    } else startNew();
  });
  function startNew() {
    get('draft-picker').close();
    const now = new Date(), date = [now.getFullYear(), now.getMonth() + 1, now.getDate()].map(n => String(n).padStart(2, '0')).join('-');
    return open({ id: `new:${crypto.randomUUID()}`, text: config.template.replaceAll('{{date}}', date) });
  }
  on(get('start-new'), 'click', startNew);
  const cancelPicker = event => { event.preventDefault?.(); get('draft-picker').close(); if (!disposed) get('new').focus(); };
  on(get('cancel-picker'), 'click', cancelPicker);
  on(get('draft-picker'), 'cancel', cancelPicker);
  on(get('back'), 'click', () => { if (!busy) return back(); });
  function saveToken() { store.token(get('remember').checked ? token.value.trim() : null); updatePublish(); renderIndex(); }
  on(token, 'input', saveToken); on(get('remember'), 'change', saveToken);
  on(get('connect'), 'click', async () => {
    saveToken(); await refresh();
    if (!disposed) { get('connection').open = false; get('connection').querySelector('summary').focus(); }
  });
  on(get('forget'), 'click', () => { token.value = ''; get('remember').checked = false; files = null; saveToken(); });
  on(get('publish'), 'click', async () => {
    if (get('publish').disabled) return;
    const snapshot = { ...session };
    const path = snapshot.path || `${config.contentDir.replace(/\/$/, '')}/${filename(snapshot.text, config)}`;
    store.save(snapshot); setBusy(true); status('Publishing…');
    try {
      const result = await api.save(path, snapshot.text, snapshot.sha);
      if (disposed) return;
      store.forget(snapshot.id);
      const entry = { path, title: titleOf(snapshot.text), draft: isDraft(snapshot.text, config), sha: result.sha };
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
  async function loadInitial() {
    setBusy(true);
    try {
      if (config.published) published = publishedIndex(config.published, config);
      else if (config.index) {
        const response = await request(config.index, { cache: 'no-store', signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]) });
        if (!response.ok) throw new Error();
        published = publishedIndex(await response.json(), config);
      }
    } catch {
      status('The published index is unavailable. Connect GitHub to list repository content.');
    } finally { setBusy(false); }
    if (disposed) return;
    renderIndex();
    if (token.value.trim()) await refresh();
    if (!disposed && config.initialPath) {
      const entry = entries().find(entry => entry.path === config.initialPath);
      if (entry) await edit(entry);
    }
  }
  void loadInitial().catch(error => status(error.message));
  return async () => { disposed = true; ++viewTicket; controller.abort(); get('draft-picker').close(); get('confirm-dialog').close(); await editor?.destroy(); for (const url of imageURLs) URL.revokeObjectURL(url); };
}
