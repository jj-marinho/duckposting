import { Editor, rootCtx, defaultValueCtx, editorViewCtx, serializerCtx } from "@milkdown/kit/core";
import { commonmark } from "@milkdown/kit/preset/commonmark";
import { history } from "@milkdown/kit/plugin/history";
import { trailing } from "@milkdown/kit/plugin/trailing";
import { $prose, replaceAll } from "@milkdown/kit/utils";
import { Plugin } from "@milkdown/kit/prose/state";
import { splitDocument, readTitle, setTitle, isDraft, setDraft } from "./document.js";
import "@milkdown/kit/prose/view/style/prosemirror.css";
import "./style.css";

// Host provides the article-shaped root. All controls stay inside this instance.
export async function mountEditor(root, session, { onChange, onReady }) {
  root.classList.add("duckposting");
  root.innerHTML = `
    <section id="metadata" class="duck-settings">
      <h2>Post settings</h2>
      <label><input id="draft-status" type="checkbox"> Draft — hidden from the blog</label>
      <label for="frontmatter">Frontmatter</label>
      <textarea id="frontmatter" spellcheck="false"></textarea>
    </section>
    <div class="duck-toolbar"><button id="source-toggle" type="button" aria-pressed="false">Markdown</button></div>
    <h1 class="article-title" id="title" contenteditable="plaintext-only" role="textbox" aria-label="Post title" data-placeholder="Your title"></h1>
    <article class="popover-hint" id="body" aria-label="Post body"></article>
    <div class="duck-controls">
      <label for="post" id="source-label" hidden>Markdown source (including frontmatter)</label>
      <textarea id="post" hidden spellcheck="true" aria-describedby="editor-status"></textarea>
      <p id="editor-status" role="status"></p>
    </div>`;

  const get = id => root.querySelector(`#${id}`);
  const post = get("post"), title = get("title"), body = get("body"), metadata = get("frontmatter");
  const controller = new AbortController();
  const { signal } = controller;
  let editor, source = false, replacing = false, disposed = false;
  post.value = session.text;
  let bodyText = splitDocument(post.value).body;
  const persist = () => onChange(post.value);
  const renderFields = () => {
    try { title.textContent = readTitle(post.value); } catch { title.textContent = ""; }
    metadata.value = splitDocument(post.value).frontmatter;
    get("draft-status").checked = isDraft(post.value);
  };
  const toggleMode = raw => {
    source = raw;
    post.hidden = get("source-label").hidden = !raw;
    title.hidden = body.hidden = raw;
    get("source-toggle").textContent = raw ? "Rich editor" : "Markdown";
    get("source-toggle").setAttribute("aria-pressed", String(raw));
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
  on(metadata, "input", () => {
    post.value = metadata.value + (metadata.value.endsWith("\n") ? "" : "\n") + bodyText;
    try { title.textContent = readTitle(post.value); } catch { title.textContent = ""; }
    get("draft-status").checked = isDraft(post.value);
    persist();
  });
  on(get("draft-status"), "change", () => { post.value = setDraft(post.value, get("draft-status").checked); renderFields(); persist(); });
  on(post, "input", () => { bodyText = splitDocument(post.value).body; renderFields(); persist(); });
  on(get("source-toggle"), "click", () => {
    if (source) {
      try { reset(); } catch (error) { get("editor-status").textContent = `Keep using Markdown: ${error.message}`; return; }
    }
    toggleMode(!source);
  });

  const autosave = $prose(ctx => new Plugin({
    view: () => ({ update(view, previous) {
      if (source || replacing || disposed || previous.doc.eq(view.state.doc)) return;
      bodyText = ctx.get(serializerCtx)(view.state.doc);
      post.value = metadata.value + bodyText;
      persist();
    } }),
  }));

  try {
    editor = await Editor.make().config(ctx => {
      ctx.set(rootCtx, body);
      ctx.set(defaultValueCtx, splitDocument(post.value).body);
    }).use(commonmark).use(history).use(trailing).use(autosave).create();
    const view = editor.action(ctx => ctx.get(editorViewCtx));
    view.dom.setAttribute("role", "textbox");
    view.dom.setAttribute("aria-label", "Post body");
    view.dom.setAttribute("aria-multiline", "true");
    view.dom.setAttribute("data-placeholder", "Start writing…");
    get("editor-status").textContent = "";
  } catch (error) {
    toggleMode(true);
    get("source-toggle").disabled = true;
    get("editor-status").textContent = `Rich editor unavailable. Markdown writing still works. ${error.message}`;
  }
  onReady();
  const destroy = async () => {
    if (disposed) return;
    disposed = true;
    controller.abort();
    await editor?.destroy();
  };
  if (!root.isConnected) await destroy();
  return { destroy, setBusy(busy) {
    title.contentEditable = busy ? "false" : "plaintext-only";
    post.disabled = metadata.disabled = get("draft-status").disabled = busy;
    get("source-toggle").disabled = busy || !editor;
    editor?.action(ctx => ctx.get(editorViewCtx).setProps({ editable: () => !busy }));
  } };
}
