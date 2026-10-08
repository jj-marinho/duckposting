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
    <section id="index"><h1>Content</h1><p class="duck-local-notice">Local drafts and remembered PATs are stored only in this browser. Clearing website data removes them. Files committed to GitHub are kept.</p><div id="entries"></div></section>
    <div id="editor" hidden></div>
    <div class="duck-controls"><div class="duck-publish-row">
      <button id="back" hidden>← All content</button><div class="duck-actions">
      <button id="publish" hidden disabled>Publish</button>
      <details id="connection"><summary aria-label="GitHub connection" title="GitHub connection">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M12 .7a11.5 11.5 0 0 0-3.64 22.41c.57.11.79-.25.79-.56v-2.2c-3.2.7-3.87-1.36-3.87-1.36-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.33.95.1-.74.4-1.24.73-1.53-2.56-.29-5.25-1.28-5.25-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.16 1.18a11 11 0 0 1 5.76 0c2.19-1.49 3.16-1.18 3.16-1.18.62 1.59.23 2.76.11 3.05.73.81 1.18 1.83 1.18 3.09 0 4.42-2.7 5.39-5.27 5.67.41.36.78 1.06.78 2.13v3.23c0 .31.21.68.79.56A11.5 11.5 0 0 0 12 .7Z"/></svg>
      </summary><div class="duck-connection">
        <label for="token">Personal access token</label><input id="token" type="password" autocomplete="off" spellcheck="false">
        <p class="duck-token-help">Use a fine-grained PAT restricted to this blog repository, with Contents: read and write. No other optional permissions are needed.</p>
        <label><input id="remember" type="checkbox"> Remember on this device</label>
        <button id="connect">Connect</button> <button id="forget">Forget</button>
      </div></details>
    </div></div><p id="status" role="status" aria-live="polite"></p>
    <p id="storage-warning" role="status" hidden>Some local data could not be read or saved. Copy your writing before closing this tab.</p></div>
    <dialog id="confirm-dialog" aria-labelledby="confirm-title" aria-describedby="confirm-description"><h2 id="confirm-title"></h2><p id="confirm-description"></p>
      <button id="confirm-yes"></button> <button id="confirm-no"></button> <button id="confirm-extra" hidden></button></dialog>`;
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
  let published = [], files = null, session, editor, versions, busy = false, ready = false, disposed = false, viewTicket = 0, focusIndex = false;
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
    const pages = entries(), byPath = new Map(pages.map(page => [page.path, page]));
    const local = Object.values(store.drafts).filter(draft => !draft.path || byPath.has(draft.path))
      .sort((a, b) => b.updated - a.updated).map(draft => ({ ...byPath.get(draft.path), local: draft }));
    for (const entry of [...local, ...pages.filter(page => !store.drafts[page.path])]) {
      const row = document.createElement('div'); row.className = 'duck-entry';
      row.dataset.path = entry.path || entry.local.id;
      row.dataset.local = String(Boolean(entry.local));
      const info = document.createElement('div'), title = document.createElement('strong'), detail = document.createElement('small');
      title.textContent = entry.local ? titleOf(entry.local.text) : entry.title;
      detail.textContent = entry.path ? `${entry.draft ? 'Draft / unpublished' : 'Published'} · ${entry.path}` : 'New post';
      info.append(title);
      if (entry.local) {
        const notice = document.createElement('span'); notice.className = 'duck-draft-label'; notice.textContent = 'Local draft';
        info.append(notice); detail.textContent += ` · ${new Date(entry.local.updated).toLocaleString()}`;
      }
      info.append(detail);
      row.append(info, button('Edit', () => entry.path ? edit(entry) : open(entry.local), busy));
      if (entry.local) row.append(button('Discard draft', async () => {
        if (!await choose('Discard this local draft?', `Remove the browser draft for “${titleOf(entry.local.text)}”? GitHub files stay unchanged.`, 'Discard draft', 'Cancel') || disposed) return;
        store.forget(entry.local.id); renderIndex(); get('new').focus();
      }, busy));
      if (entry.path) row.append(button('Delete', () => remove(entry), busy || !token.value.trim()));
      list.append(row);
    }
    if (!list.children.length) list.textContent = 'No content yet. Start a post or connect GitHub to load repository drafts.';
  }
  function updatePublish() {
    let valid = false;
    try {
      const title = readTitle(session?.text || '');
      if (!session?.path) filename(session?.text || '', config);
      valid = Boolean(title.trim()) && !/[\r\n]/.test(title) && Boolean(splitDocument(session.text).body.trim());
      isDraft(session.text, config);
    } catch {}
    get('publish').disabled = busy || !ready || versions?.selected !== 'working' || !valid || !token.value.trim() || config.repository === 'YOUR-USERNAME/YOUR-BLOG';
  }
  function setBusy(value) {
    if (disposed) return;
    busy = value;
    get('back').disabled = get('new').disabled = get('connect').disabled = get('forget').disabled = token.disabled = get('remember').disabled = value;
    editor?.setBusy(value); updatePublish(); renderIndex();
    if (versions) { versions.select.disabled = value || versions.loading; versions.restore.disabled = value; }
    if (!value && focusIndex) { focusIndex = false; get('new').focus(); }
  }
  async function refresh() {
    if (!token.value.trim()) return;
    setBusy(true); status('Loading repository…');
    try { files = await api.list(); status(''); }
    catch (error) { status(`Could not load GitHub. ${error.message}`); }
    finally { setBusy(false); }
  }
  const draftLabel = draft => store.drafts[draft.id]?.text === draft.text ? `Draft ${new Date(store.drafts[draft.id].updated).toLocaleString()}` : draft.path ? 'Current version' : 'New post';
  function renderVersions(state) {
    const option = (value, label) => { const node = document.createElement('option'); node.value = value; node.textContent = label; return node; };
    state.workingOption = option('working', draftLabel(state.working));
    state.select.replaceChildren(state.workingOption);
    const local = store.drafts[state.working.id];
    if (local && local.text !== state.working.text) state.select.append(option('draft', draftLabel(local)));
    if (state.commits.length) {
      const group = document.createElement('optgroup'); group.label = 'GitHub commits';
      for (const commit of state.commits) group.append(option(commit.sha, `Commit ${commit.sha.slice(0, 7)} “${commit.message}” · ${new Date(commit.date).toLocaleString()}`));
      state.select.append(group);
    }
    if (state.more) {
      const more = option('more', token.value.trim() ? state.loaded ? 'Load earlier commits…' : 'Load commit history…' : 'Connect GitHub for history');
      more.disabled = !token.value.trim(); state.select.append(more);
    }
    state.select.value = state.selected;
    state.select.disabled = busy || state.loading;
    state.restore.hidden = state.selected === 'working';
  }
  async function loadHistory(state) {
    if (state.loading || !state.working.path || !token.value.trim()) return;
    state.loading = true; state.select.disabled = true;
    try {
      const page = await api.history(state.working.path, state.page);
      if (disposed || versions !== state) return;
      state.commits.push(...page.commits); state.more = page.more; state.page++; state.loaded = true;
    } catch (error) {
      if (!disposed && versions === state) status(`Could not load commit history. ${error.message} Your writing is kept; choose Load commit history to retry.`);
    } finally {
      state.loading = false;
      if (!disposed && versions === state) renderVersions(state);
    }
  }
  function versionControl(working) {
    const control = document.createElement('div'), select = document.createElement('select'); control.className = 'duck-versions';
    select.setAttribute('aria-label', 'Post versions');
    const state = { control, select, working, selected: 'working', commits: [], page: 1, more: Boolean(working.path), loaded: false, loading: false };
    state.restore = button('Use this version', async () => {
      if (busy || versions !== state || state.selected === 'working') return;
      if (store.drafts[state.working.id] && !await choose('Replace your local draft?', 'This version replaces the browser draft for this document. GitHub stays unchanged until you Publish.', 'Use this version', 'Cancel')) return;
      if (disposed || versions !== state) return;
      const draft = { ...state.working, text: session.text };
      store.save(draft); state.selected = 'working';
      await open(draft, state);
      status('Version restored to your local draft. Publish when ready.');
    });
    control.append(select, state.restore);
    on(select, 'change', async () => {
      if (busy || versions !== state) return;
      const value = select.value, previous = state.selected;
      if (value === 'more') { select.value = previous; return loadHistory(state); }
      if (value === 'working') { state.selected = value; return open(state.working, state); }
      if (value === 'draft' && store.drafts[state.working.id]) { state.selected = 'working'; return open(store.drafts[state.working.id], state); }
      if (!state.commits.some(commit => commit.sha === value)) return;
      setBusy(true);
      try {
        const file = await api.read(state.working.path, value);
        if (disposed || versions !== state) return;
        state.selected = value;
        await open({ ...state.working, text: file.text }, state);
        status('Viewing a commit. Your current writing is kept. Choose Use this version to restore it.');
      } catch (error) { if (!disposed && versions === state) { select.value = previous; status(`Could not open this version. ${error.message} Your writing is kept.`); } }
      finally { if (!disposed && versions === state) setBusy(false); }
    });
    return state;
  }
  async function open(draft, state = versionControl(draft)) {
    if (disposed) return;
    const ticket = ++viewTicket, current = { ...draft }, previous = editor;
    versions = state;
    const readOnly = state.selected !== 'working';
    if (!readOnly) state.working = current;
    editor = undefined; session = current; ready = false;
    setBusy(true);
    get('index').hidden = get('new').hidden = true;
    get('editor').hidden = get('back').hidden = get('publish').hidden = false;
    status(''); updatePublish();
    try {
      await previous?.destroy();
      if (disposed || ticket !== viewTicket) return;
      const mounted = await createEditor(get('editor'), current, {
        config, versionControl: state.control, readOnly,
        onChange(text) {
          if (disposed || ticket !== viewTicket || readOnly) return;
          current.text = text; store.save(current); updatePublish();
          state.workingOption.textContent = draftLabel(current);
          state.select.querySelector('option[value="draft"]')?.remove();
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
          if (busy || readOnly) throw new Error('Return to your current writing before uploading an image.');
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
      renderVersions(state);
      if (!state.loaded) void loadHistory(state);
    } finally { if (!disposed && ticket === viewTicket) setBusy(false); }
    if (!disposed && ticket === viewTicket) { if (readOnly) state.select.focus(); else editor?.focus?.(); }
  }
  async function back() {
    ++viewTicket;
    const previous = editor;
    editor = undefined; session = undefined; versions = undefined; ready = false;
    await previous?.destroy();
    if (disposed) return;
    get('editor').hidden = get('back').hidden = get('publish').hidden = true;
    get('index').hidden = get('new').hidden = false; renderIndex();
    if (busy) focusIndex = true; else get('new').focus();
  }
  function choose(title, description, yes, no, extra) {
    const dialog = get('confirm-dialog');
    const trigger = root.ownerDocument.activeElement;
    get('confirm-title').textContent = title; get('confirm-description').textContent = description;
    get('confirm-yes').textContent = yes; get('confirm-no').textContent = no;
    get('confirm-extra').hidden = !extra; get('confirm-extra').textContent = extra || '';
    return new Promise(resolve => {
      let finished = false;
      const finish = value => {
        if (finished) return;
        finished = true; cleanup(); dialog.close();
        if (!disposed && trigger?.isConnected) trigger.focus();
        resolve(value);
      };
      const accept = () => finish(true), decline = () => finish(false), extraChoice = () => finish('extra');
      const cancel = event => { event.preventDefault?.(); finish(null); };
      const cleanup = () => { get('confirm-yes').removeEventListener('click', accept); get('confirm-no').removeEventListener('click', decline); get('confirm-extra').removeEventListener('click', extraChoice); dialog.removeEventListener('cancel', cancel); dialog.removeEventListener('close', cancel); signal.removeEventListener('abort', cancel); };
      get('confirm-yes').addEventListener('click', accept, { signal }); get('confirm-no').addEventListener('click', decline, { signal }); dialog.addEventListener('cancel', cancel, { signal }); dialog.addEventListener('close', cancel, { signal });
      get('confirm-extra').addEventListener('click', extraChoice, { signal });
      signal.addEventListener('abort', cancel, { once: true });
      dialog.showModal();
      get('confirm-no').focus();
    });
  }
  async function edit(entry) {
    if (busy) return;
    const local = store.drafts[entry.path];
    let discard = false;
    if (local) {
      const choice = await choose('Resume local changes?', `One local draft for “${titleOf(local.text)}”, saved ${new Date(local.updated).toLocaleString()}.`, 'Use local draft', 'Use repository version', 'Discard draft & edit');
      if (choice === null) return;
      if (choice === true) return open(local);
      discard = choice === 'extra';
    }
    if (disposed) return;
    if (!token.value.trim()) { get('connection').open = true; token.focus(); status('Connect GitHub to read the Markdown for this document.'); return; }
    setBusy(true);
    try {
      const file = await api.read(entry.path);
      if (disposed) return;
      if (discard) store.forget(entry.path);
      await open({ id: entry.path, path: entry.path, ...file });
    }
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
  on(get('new'), 'click', () => {
    if (busy) return;
    const now = new Date(), date = [now.getFullYear(), now.getMonth() + 1, now.getDate()].map(n => String(n).padStart(2, '0')).join('-');
    return open({ id: `new:${crypto.randomUUID()}`, text: config.template.replaceAll('{{date}}', date) });
  });
  on(get('back'), 'click', () => { if (!busy) return back(); });
  function saveToken() { store.token(get('remember').checked ? token.value.trim() : null); updatePublish(); renderIndex(); }
  on(token, 'input', saveToken); on(get('remember'), 'change', saveToken);
  on(get('connect'), 'click', async () => {
    saveToken(); await refresh();
    if (versions) { renderVersions(versions); if (!versions.loaded) void loadHistory(versions); }
    if (!disposed) { get('connection').open = false; get('connection').querySelector('summary').focus(); }
  });
  on(get('forget'), 'click', () => { token.value = ''; get('remember').checked = false; files = null; saveToken(); if (versions) renderVersions(versions); });
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
  return async () => { disposed = true; ++viewTicket; controller.abort(); get('confirm-dialog').close(); await editor?.destroy(); for (const url of imageURLs) URL.revokeObjectURL(url); };
}
