import { Editor, rootCtx, defaultValueCtx, editorViewCtx, serializerCtx } from "@milkdown/kit/core";
import { commonmark } from "@milkdown/kit/preset/commonmark";
import { history } from "@milkdown/kit/plugin/history";
import { trailing } from "@milkdown/kit/plugin/trailing";
import { $prose, replaceAll } from "@milkdown/kit/utils";
import { Plugin } from "@milkdown/kit/prose/state";
import { splitDocument, readTitle, setTitle, isDraft, setDraft, readDate, setDate, joinDocument, needsSourceMode } from "./document.js";
import "@milkdown/kit/prose/view/style/prosemirror.css";
import "./style.css";

// Host provides the article-shaped root. All controls stay inside this instance.
export async function mountEditor(root, session, { onChange, onReady }) {
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
        <button id="source-toggle" type="button" aria-pressed="false">Markdown</button>
      </div>
      <details id="metadata" class="duck-settings">
        <summary>Post settings</summary>
        <label for="frontmatter">Frontmatter</label>
        <textarea id="frontmatter" spellcheck="false"></textarea>
      </details>
      <p id="editor-status" role="status"></p>
    </div>`;

  const get = id => root.querySelector(`#${id}`);
  const post = get("post"), title = get("title"), body = get("body"), metadata = get("frontmatter");
  const controller = new AbortController();
  const { signal } = controller;
  let editor, source = false, replacing = false, disposed = false, initializing = true, fieldsValid = true, busy = true;
  post.disabled = metadata.disabled = get("source-toggle").disabled = true;
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
    else if (!title.textContent.trim()) title.focus();
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
    }).use(commonmark).use(history).use(trailing).use(autosave);
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
  validateFields();
  onReady();
  const destroy = async () => {
    if (disposed) return;
    disposed = true;
    controller.abort();
    await editor?.destroy();
  };
  if (!root.isConnected) await destroy();
  return { destroy, focus, setBusy(value) {
    busy = value;
    title.contentEditable = busy || !fieldsValid ? "false" : "plaintext-only";
    post.disabled = metadata.disabled = busy;
    get("draft-status").disabled = get("post-date").disabled = busy || !fieldsValid;
    get("source-toggle").disabled = busy || !editor;
    editor?.action(ctx => ctx.get(editorViewCtx).setProps({ editable: () => !busy }));
  } };
}
