import { Editor, rootCtx, defaultValueCtx, editorViewCtx, serializerCtx, parserCtx } from "@milkdown/kit/core";
import { commonmark, imageSchema } from "@milkdown/kit/preset/commonmark";
import { gfm, extendListItemSchemaForTask } from "@milkdown/kit/preset/gfm";
import { Plugin, TextSelection } from "@milkdown/kit/prose/state";
import { insertFragment, sourceFragment } from './insert.js';
import { commandMenu } from "./menu.js";
import { sourceCommandQuery, linkMarkdown, externalLink, matchingPages } from "./commands.js";
import { transferImages } from './media.js';
import { tableTools } from './tables.js';
import { history } from "@milkdown/kit/plugin/history";
import { trailing } from "@milkdown/kit/plugin/trailing";
import { $prose, $view, replaceAll } from "@milkdown/kit/utils";
import { splitDocument, readTitle, setTitle, isDraft, setDraft, readDate, setDate, joinDocument, needsSourceMode } from "./document.js";
import "@milkdown/kit/prose/view/style/prosemirror.css";
import "./style.css";
import { mathPlugins } from "./math.js";
import { imageURL, imageMarkdown, parseImage } from "./images.js";
import katex from "katex";

// Host provides the article-shaped root. All controls stay inside this instance.
export async function mountEditor(root, session, { onChange, onReady, imageSource = async src => imageURL(src), uploadImage, getPages = () => [] }) {
  root.classList.add("duckposting");
  root.innerHTML = `
    <h1 class="article-title" id="title" contenteditable="plaintext-only" role="textbox" aria-label="Post title" data-placeholder="Your title"></h1>
    <input id="post-date" class="duck-date" type="date" aria-label="Post date">
    <article class="popover-hint" id="body" aria-label="Post body"></article>
    <label for="post" id="source-label" hidden>Markdown source (including frontmatter)</label>
    <textarea id="post" hidden spellcheck="true" aria-describedby="editor-status"></textarea>
    <div class="duck-editor-tools">
      <div class="duck-options">
        <label class="duck-draft"><input id="draft-status" type="checkbox"> Draft <span class="duck-muted">— hidden from the blog</span></label>
        <div class="duck-insert"><button id="insert" type="button" aria-haspopup="listbox" aria-expanded="false">Insert <span aria-hidden="true">/</span></button>
        <button id="source-toggle" type="button" aria-pressed="false">Markdown</button></div>
      </div>
      <details id="metadata" class="duck-settings">
        <summary>Post settings</summary>
        <label for="frontmatter">Frontmatter</label>
        <textarea id="frontmatter" spellcheck="false"></textarea>
      </details>
      <p id="editor-status" role="status"></p>
    </div>
    <dialog id="image-dialog" aria-labelledby="image-heading"><h2 id="image-heading">Add an image</h2>
      <form id="image-form"><label for="image-url">Image URL or blog path</label><input id="image-url" type="text" placeholder="https://…" autocomplete="off">
      <label for="image-file">Or upload an image (up to 10 MB)</label><input id="image-file" type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/avif">
      <label for="image-alt">Description (alt text)</label><input id="image-alt" type="text">
      <p class="duck-note">Uploads are saved immediately and may be public even while the post is a draft.</p><p id="image-error" role="status"></p><button id="insert-image" type="submit">Insert image</button> <button id="cancel-image" type="button">Cancel</button></form>
    </dialog>
    <dialog id="math-dialog" aria-labelledby="math-heading"><h2 id="math-heading">Edit equation</h2>
      <form id="math-form"><label for="math-source">LaTeX</label><textarea id="math-source" spellcheck="false"></textarea>
      <p id="math-error" role="status"></p><button type="submit">Save equation</button> <button id="cancel-math" type="button">Cancel</button></form>
    </dialog>
    <dialog id="page-dialog" aria-labelledby="page-heading"><h2 id="page-heading">Link a page</h2>
      <label for="page-query">Search pages</label><input id="page-query" type="text" autocomplete="off" placeholder="Title or path…">
      <div id="page-results"></div><button id="cancel-page" type="button">Cancel</button>
    </dialog>
    <dialog id="link-dialog" aria-labelledby="link-heading"><h2 id="link-heading">Link a URL</h2>
      <form id="link-form"><label for="link-url">URL</label><input id="link-url" type="text" placeholder="https://…" autocomplete="off" required>
      <label for="link-label">Link text</label><input id="link-label" type="text">
      <p id="link-error" role="status"></p><button type="submit">Insert link</button> <button id="cancel-link" type="button">Cancel</button></form>
    </dialog>`;

  const get = id => root.querySelector(`#${id}`);
  const post = get("post"), title = get("title"), body = get("body"), metadata = get("frontmatter");
  const controller = new AbortController();
  const { signal } = controller;
  let editor, source = false, replacing = false, disposed = false, initializing = true, fieldsValid = true, busy = true;
  post.disabled = metadata.disabled = get("source-toggle").disabled = get("insert").disabled = true;
  let mathSelection, imageSelection, linkSelection, uploading = false;
  let fieldError = "", sourceWarning = "";
  post.value = session.text;
  let bodyText = splitDocument(post.value).body;
  const persist = () => onChange(post.value);
  const validateFields = () => {
    try {
      title.textContent = readTitle(post.value);
      get("draft-status").checked = isDraft(post.value);
      get("post-date").value = readDate(post.value);
      fieldsValid = true;
      fieldError = "";
    } catch (error) {
      fieldsValid = false;
      fieldError = error.message;
    }
    get("editor-status").textContent = fieldError || (source ? sourceWarning : "");
    title.contentEditable = busy || !fieldsValid ? "false" : "plaintext-only";
    get("draft-status").disabled = get("post-date").disabled = busy || !fieldsValid;
  };
  const renderFields = () => {
    metadata.value = splitDocument(post.value).frontmatter;
    validateFields();
  };
  const toggleMode = raw => {
    source = raw;
    post.hidden = get("source-label").hidden = !raw;
    title.hidden = body.hidden = get("post-date").hidden = raw;
    get("source-toggle").textContent = raw ? "Rich editor" : "Markdown";
    get("source-toggle").setAttribute("aria-pressed", String(raw));
    get("editor-status").textContent = fieldError || (source ? sourceWarning : "");
  };
  const focus = () => {
    if (disposed) return;
    if (source) post.focus();
    else editor?.action(ctx => ctx.get(editorViewCtx).focus());
  };
  const reset = () => {
    if (disposed) return;
    bodyText = splitDocument(post.value).body;
    renderFields();
    if (!editor) return;
    replacing = true;
    try { editor.action(replaceAll(splitDocument(post.value).body)); }
    finally { replacing = false; }
  };
  renderFields();
  const on = (node, event, fn) => node.addEventListener(event, fn, { signal });
  on(title, "input", () => {
    const value = title.textContent.replace(/\r?\n/g, " ");
    if (value !== title.textContent) title.textContent = value;
    post.value = setTitle(post.value, value);
    metadata.value = splitDocument(post.value).frontmatter;
    persist();
  });
  on(get("post-date"), "change", () => { post.value = setDate(post.value, get("post-date").value); renderFields(); persist(); });
  on(metadata, "input", () => {
    post.value = joinDocument(metadata.value, bodyText);
    validateFields();
    persist();
  });
  on(get("draft-status"), "change", () => { post.value = setDraft(post.value, get("draft-status").checked); renderFields(); persist(); });
  on(post, "input", () => { bodyText = splitDocument(post.value).body; renderFields(); persist(); });
  on(get("source-toggle"), "click", () => {
    if (source) {
      try { readTitle(post.value); reset(); } catch (error) { get("editor-status").textContent = `Keep using Markdown: ${error.message}`; return; }
    }
    toggleMode(!source);
    focus();
  });

  const capture = bookmark => source ? { source: true, from: post.selectionStart, to: post.selectionEnd } : { source: false, bookmark: bookmark || editor.action(ctx => ctx.get(editorViewCtx).state.selection.getBookmark()) };
  function insertMarkdown(markdown, target, block = false, placeholder = false) {
    if (disposed || busy) return;
    if (target.source) {
      const fragment = sourceFragment(markdown, block, placeholder);
      post.setRangeText(fragment.text, target.from, target.to, "end");
      post.setSelectionRange(target.from + fragment.from, target.from + fragment.to);
      bodyText = splitDocument(post.value).body; renderFields(); persist();
    } else editor.action(ctx => {
      const view = ctx.get(editorViewCtx), selection = target.bookmark.resolve(view.state.doc);
      const doc = ctx.get(parserCtx)(markdown);
      view.dispatch(insertFragment(view.state, selection, doc, block, placeholder));
    });
    focus();
  }
  const menu = commandMenu(root, { capture, blocked: () => busy || uploading || disposed, error: message => get('editor-status').textContent = message, run(command, target) {
    if (command.markdown) insertMarkdown(command.markdown, target, true, command.placeholder);
    else if (command.id === 'image') openImage(target);
    else if (command.id === 'math') editMath({ target });
    else if (command.id === 'page') {
      linkSelection = target; get('page-query').value = ''; renderPages();
      get('page-dialog').showModal(); get('page-query').focus();
    } else if (command.id === 'url') {
      linkSelection = target; get('link-form').reset(); get('link-error').textContent = '';
      get('link-dialog').showModal(); get('link-url').focus();
    }
  } });
  on(get('insert'), 'click', () => menu.open(capture(), get('insert')));
  on(post, 'input', () => {
    if (busy || post.selectionStart !== post.selectionEnd || post.selectionStart < splitDocument(post.value).frontmatter.length) { menu.close(); return; }
    const match = sourceCommandQuery(post.value, post.selectionStart);
    if (!match) { menu.close(); return; }
    menu.source(match.query, { source: true, from: post.selectionStart - match.length, to: post.selectionStart, key: `${post.selectionStart}:${match.query}` }, get('insert'));
  });
  on(post, 'keydown', event => menu.key(event));
  on(get('source-toggle'), 'click', () => menu.close());
  on(body, 'click', event => { if (event.target.closest('a')) event.preventDefault(); });
  let pageItems = [], pageIndex = 0;
  function renderPages() {
    pageItems = matchingPages(getPages(), get('page-query').value); pageIndex = 0;
    const list = get('page-results'); list.replaceChildren();
    for (const [index, page] of pageItems.entries()) {
      const button = document.createElement('button'); button.type = 'button';
      const title = document.createElement('strong'), detail = document.createElement('small');
      title.textContent = page.title; detail.textContent = `${page.draft ? 'Draft · ' : ''}${page.path}`;
      button.append(title, detail); button.setAttribute('aria-current', String(index === pageIndex));
      button.dataset.index = index; list.append(button);
    }
    if (!pageItems.length) list.textContent = 'No matching pages.';
  }
  on(get('page-results'), 'click', event => {
    const button = event.target.closest('button[data-index]');
    if (!button) return;
    const page = pageItems[Number(button.dataset.index)];
    insertMarkdown(linkMarkdown(page.title, page.href), linkSelection); get('page-dialog').close(); focus();
  });
  on(get('page-query'), 'input', renderPages);
  on(get('page-query'), 'keydown', event => {
    if (event.isComposing || !pageItems.length) return;
    if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault(); pageIndex = (pageIndex + (event.key === 'ArrowDown' ? 1 : -1) + pageItems.length) % pageItems.length;
      for (const [i, button] of [...get('page-results').children].entries()) button.setAttribute('aria-current', String(i === pageIndex));
      get('page-results').children[pageIndex].scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter') { event.preventDefault(); get('page-results').children[pageIndex].click(); }
  });
  on(get('link-form'), 'submit', event => {
    event.preventDefault();
    try { insertMarkdown(linkMarkdown(get('link-label').value, externalLink(get('link-url').value)), linkSelection); get('link-dialog').close(); focus(); }
    catch (error) { get('link-error').textContent = error.message; }
  });
  for (const name of ['page', 'link']) {
    on(get(`cancel-${name}`), 'click', () => { get(`${name}-dialog`).close(); focus(); });
    on(get(`${name}-dialog`), 'close', focus);
  }
  const editMath = selection => {
    if (busy || disposed) return;
    mathSelection = selection; get("math-source").value = selection.node?.attrs.value || "";
    get("math-error").textContent = ""; get("math-dialog").showModal(); get("math-source").focus();
  };
  on(get("math-form"), "submit", event => {
    event.preventDefault();
    try {
      const value = get("math-source").value.trim();
      katex.renderToString(value, { trust: false, maxSize: 20 });
      if (!value) throw new Error('Enter an equation.');
      const { view, pos, node, target } = mathSelection;
      if (target) insertMarkdown(`$$\n${value}\n$$`, target, true);
      else view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, value }));
      get("math-dialog").close(); focus();
    } catch (error) { get("math-error").textContent = error.message; }
  });
  on(get("cancel-math"), "click", () => { get("math-dialog").close(); focus(); });
  on(get("math-dialog"), "cancel", () => focus());
  function openImage(target) {
    if (busy) return;
    imageSelection = target;
    get("image-form").reset(); get("image-error").textContent = "";
    get("image-dialog").showModal(); get("image-url").focus();
  }
  on(get("image-file"), "change", () => {
    const file = get("image-file").files[0];
    if (file && !get("image-alt").value) get("image-alt").value = file.name.replace(/\.[^.]+$/, "");
  });
  on(get("image-form"), "submit", async event => {
    event.preventDefault();
    if (get("insert-image").disabled) return;
    get("insert-image").disabled = get("cancel-image").disabled = true;
    try {
      const file = get("image-file").files[0], alt = get("image-alt").value;
      const src = file ? await uploadImage(file) : imageURL(get("image-url").value);
      if (disposed) return;
      insertMarkdown(imageMarkdown(src, alt), imageSelection);
      get("image-dialog").close(); focus();
    } catch (error) { if (!disposed) get("image-error").textContent = error.message; }
    finally { if (!disposed) get("insert-image").disabled = get("cancel-image").disabled = false; }
  });
  on(get("cancel-image"), "click", () => { get("image-dialog").close(); focus(); });
  on(get("image-dialog"), "cancel", event => { if (busy) event.preventDefault(); else focus(); });
  const imageNodes = imageSchema.extendSchema(original => ctx => {
    const spec = original(ctx);
    return { ...spec, parseMarkdown: { ...spec.parseMarkdown, runner: parseImage } };
  });
  const images = $view(imageNodes.node, () => (node) => {
    const dom = document.createElement("span"), img = document.createElement("img"), error = document.createElement("small");
    dom.className = "duck-image"; dom.contentEditable = "false"; error.hidden = true;
    let ticket = 0;
    const render = current => {
      node = current; const currentTicket = ++ticket; img.alt = node.attrs.alt || ""; img.title = node.attrs.title || "";
      img.hidden = false; error.hidden = true;
      imageSource(node.attrs.src).then(src => { if (currentTicket === ticket && !disposed) img.src = src; }).catch(() => { if (currentTicket === ticket && !disposed) img.dispatchEvent(new Event("error")); });
    };
    img.addEventListener("error", () => { img.hidden = true; error.hidden = false; error.textContent = `Image unavailable: ${node.attrs.alt || node.attrs.src}`; });
    dom.append(img, error); render(node);
    return { dom, update(next) { if (next.type !== node.type) return false; if (next !== node) render(next); return true; }, destroy() { ticket++; }, ignoreMutation: () => true };
  });

  const tasks = $view(extendListItemSchemaForTask.node, () => (node, view, getPos) => {
    const dom = document.createElement('li'), contentDOM = document.createElement('div'), checkbox = document.createElement('input'), label = document.createElement('label');
    checkbox.type = 'checkbox'; checkbox.contentEditable = 'false'; checkbox.setAttribute('aria-label', 'Completed');
    label.className = 'duck-task-check'; label.contentEditable = 'false'; label.append(checkbox); dom.append(label, contentDOM);
    const render = current => {
      node = current; label.hidden = node.attrs.checked == null; checkbox.checked = Boolean(node.attrs.checked); checkbox.disabled = !view.editable;
      dom.dataset.itemType = node.attrs.checked == null ? 'bullet' : 'task';
      for (const key of ['label', 'listType', 'spread', 'checked']) {
        if (node.attrs[key] == null) delete dom.dataset[key]; else dom.dataset[key] = node.attrs[key];
      }
    };
    checkbox.addEventListener('change', () => {
      if (!view.editable) { checkbox.checked = Boolean(node.attrs.checked); return; }
      view.dispatch(view.state.tr.setNodeMarkup(getPos(), undefined, { ...node.attrs, checked: checkbox.checked }));
    }); render(node);
    return { dom, contentDOM, update(next) { if (next.type !== node.type) return false; render(next); return true; }, stopEvent: event => label.contains(event.target), ignoreMutation: mutation => label.contains(mutation.target) || mutation.type === 'attributes' && mutation.target === dom };
  });
  async function uploadFiles(files, target) {
    if (busy || uploading || disposed) return;
    uploading = true;
    get('editor-status').textContent = fieldError || (source ? sourceWarning : '');
    try {
      for (const file of files) {
        const src = await uploadImage(file); if (disposed) return;
        insertMarkdown(imageMarkdown(src, file.name.replace(/\.[^.]+$/, '')), target); target = capture();
      }
    } catch (error) { if (!disposed) get('editor-status').textContent = `Image upload failed. ${error.message} Your writing is kept.`; }
    finally { uploading = false; }
  }
  const media = $prose(() => new Plugin({ props: {
    handlePaste: (view, event) => transferImages(event, uploadFiles, () => capture(view.state.selection.getBookmark())),
    handleDrop(view, event) {
      return transferImages(event, uploadFiles, () => {
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? view.state.selection.from;
        return capture(TextSelection.near(view.state.doc.resolve(pos)).getBookmark());
      });
    },
  } }));
  on(post, 'paste', event => transferImages(event, uploadFiles, capture));
  on(post, 'dragover', event => { if ([...(event.dataTransfer?.items || [])].some(item => item.type.startsWith('image/'))) event.preventDefault(); });
  on(post, 'drop', event => transferImages(event, uploadFiles, capture));
  const autosave = $prose(ctx => new Plugin({
    view: () => ({ update(view, previous) {
      if (initializing || source || replacing || disposed || previous.doc.eq(view.state.doc)) return;
      bodyText = ctx.get(serializerCtx)(view.state.doc);
      post.value = joinDocument(metadata.value, bodyText);
      persist();
    } }),
  }));

  try {
    editor = Editor.make().config(ctx => {
      ctx.set(rootCtx, body);
      ctx.set(defaultValueCtx, splitDocument(post.value).body);
    }).use(commonmark.filter(plugin => !imageSchema.includes(plugin))).use(imageNodes).use(gfm).use(tableTools).use(tasks).use(menu.plugin).use(media).use(mathPlugins(editMath)).use(images).use(history).use(trailing).use(autosave);
    await editor.create();
    const view = editor.action(ctx => ctx.get(editorViewCtx));
    view.dom.setAttribute("role", "textbox");
    view.dom.setAttribute("aria-label", "Post body");
    view.dom.setAttribute("aria-multiline", "true");
    view.dom.setAttribute("data-placeholder", "Start writing…");
    const serialized = editor.action(ctx => ctx.get(serializerCtx)(view.state.doc));
    if (!fieldsValid || needsSourceMode(bodyText, serialized)) {
      sourceWarning = "This document has Markdown the rich editor would rewrite. Source mode preserves it. Choose Rich editor only if you want that conversion when editing.";
      toggleMode(true);
    }
  } catch (error) {
    try { await editor?.destroy(); } catch { /* Fall back even when partial setup cannot be cleaned up. */ }
    editor = undefined;
    sourceWarning = `Rich editor unavailable. Markdown writing still works. ${error.message}`;
    toggleMode(true);
    get("source-toggle").disabled = true;
  }
  initializing = false;
  busy = false;
  post.disabled = metadata.disabled = false;
  get("source-toggle").disabled = !editor;
  get("insert").disabled = false;
  validateFields();
  onReady();
  const destroy = async () => {
    if (disposed) return;
    disposed = true;
    controller.abort();
    for (const name of ['image', 'math', 'page', 'link']) get(`${name}-dialog`).close();
    menu.destroy();
    await editor?.destroy();
  };
  if (!root.isConnected) await destroy();
  return { destroy, focus() { if (!source && !title.textContent.trim()) title.focus(); else focus(); }, setBusy(value) {
    busy = value;
    if (busy) menu.close();
    for (const control of body.querySelectorAll('input[type=checkbox], .duck-table-tools button')) control.disabled = busy;
    title.contentEditable = busy || !fieldsValid ? "false" : "plaintext-only";
    post.disabled = metadata.disabled = busy;
    get("draft-status").disabled = get("post-date").disabled = busy || !fieldsValid;
    get("source-toggle").disabled = busy || !editor;
    get("insert").disabled = busy;
    editor?.action(ctx => ctx.get(editorViewCtx).setProps({ editable: () => !busy }));
  } };
}
