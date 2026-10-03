import { Editor, rootCtx, defaultValueCtx, editorViewCtx, serializerCtx } from "@milkdown/kit/core";
import { commonmark } from "@milkdown/kit/preset/commonmark";
import { history } from "@milkdown/kit/plugin/history";
import { trailing } from "@milkdown/kit/plugin/trailing";
import { $prose, replaceAll } from "@milkdown/kit/utils";
import { Plugin } from "@milkdown/kit/prose/state";
import { splitDocument, readTitle, setTitle } from "./document.js";
import { connectPublishing } from "./publishing.js";
import "@milkdown/kit/prose/view/style/prosemirror.css";
import "./style.css";

// Host provides the article-shaped root. All controls stay inside this instance.
export async function mountDuckposting(root, config) {
  root.classList.add("duckposting");
  root.innerHTML = `
    <div class="duck-toolbar">
      <button id="source-toggle" type="button" aria-pressed="false">Markdown</button>
    </div>
    <h1 class="article-title" id="title" contenteditable="plaintext-only" role="textbox" aria-label="Post title" data-placeholder="Your title"></h1>
    <article class="popover-hint" id="body" aria-label="Post body"></article>
    <div class="duck-controls">
      <label for="post" id="source-label" hidden>Markdown source (including frontmatter)</label>
      <textarea id="post" hidden spellcheck="true" aria-describedby="status"></textarea>
      <details id="metadata"><summary>Post settings</summary>
        <label for="frontmatter">Frontmatter</label>
        <textarea id="frontmatter" spellcheck="false"></textarea>
      </details>
      <div class="duck-actions">
        <button id="sync" type="button" disabled>Sync</button>
        <details id="connection"><summary aria-label="GitHub connection" title="GitHub connection">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M12 .7a11.5 11.5 0 0 0-3.64 22.41c.57.11.79-.25.79-.56v-2.2c-3.2.7-3.87-1.36-3.87-1.36-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.33.95.1-.74.4-1.24.73-1.53-2.56-.29-5.25-1.28-5.25-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.16 1.18a11 11 0 0 1 5.76 0c2.19-1.49 3.16-1.18 3.16-1.18.62 1.59.23 2.76.11 3.05.73.81 1.18 1.83 1.18 3.09 0 4.42-2.7 5.39-5.27 5.67.41.36.78 1.06.78 2.13v3.23c0 .31.21.68.79.56A11.5 11.5 0 0 0 12 .7Z"/></svg>
        </summary><div class="duck-connection">
          <label for="token">Personal access token</label>
          <input id="token" type="password" autocomplete="off" spellcheck="false">
          <label><input id="remember" type="checkbox"> Remember on this device</label>
          <button id="forget" type="button">Forget</button>
        </div></details>
      </div>
      <p id="status" role="status" aria-live="polite">Loading editor…</p>
      <p id="storage-warning" role="status" hidden>Local saving is unavailable. Keep this tab open to preserve your draft.</p>
    </div>`;

  const get = id => root.querySelector(`#${id}`);
  const post = get("post"), title = get("title"), body = get("body"), metadata = get("frontmatter");
  const controller = new AbortController();
  const { signal } = controller;
  let editor, source = false, replacing = false, disposed = false, ready = false;
  const persist = () => post.dispatchEvent(new Event("input"));
  const renderFields = () => {
    try { title.textContent = readTitle(post.value); } catch { title.textContent = ""; }
    metadata.value = splitDocument(post.value).frontmatter;
  };
  const toggleMode = raw => {
    source = raw;
    post.hidden = get("source-label").hidden = !raw;
    title.hidden = body.hidden = get("metadata").hidden = raw;
    get("source-toggle").textContent = raw ? "Rich editor" : "Markdown";
    get("source-toggle").setAttribute("aria-pressed", String(raw));
  };
  const reset = () => {
    if (disposed) return;
    renderFields();
    if (!editor) return;
    replacing = true;
    try { editor.action(replaceAll(splitDocument(post.value).body)); }
    finally { replacing = false; }
  };
  const updateSync = connectPublishing(root, config, {
    signal, onReset: reset, canSync: () => ready,
    onBusy(busy) {
      if (disposed) return;
      title.contentEditable = busy ? "false" : "plaintext-only";
      metadata.disabled = busy;
      root.querySelectorAll("#source-toggle").forEach(button => button.disabled = busy);
      editor?.action(ctx => ctx.get(editorViewCtx).setProps({ editable: () => !busy }));
    },
  });
  renderFields();
  const on = (node, event, fn) => node.addEventListener(event, fn, { signal });
  on(title, "input", () => {
    post.value = setTitle(post.value, title.textContent);
    metadata.value = splitDocument(post.value).frontmatter;
    persist();
  });
  on(metadata, "input", () => {
    const { body } = splitDocument(post.value);
    post.value = metadata.value.replace(/\s*$/, "") + "\n\n" + body.replace(/^\s*\n/, "");
    try { title.textContent = readTitle(post.value); } catch { title.textContent = ""; }
    persist();
  });
  on(get("source-toggle"), "click", () => {
    if (source) {
      try { reset(); } catch (error) { get("status").textContent = `Keep using Markdown: ${error.message}`; return; }
    }
    toggleMode(!source);
  });

  const autosave = $prose(ctx => new Plugin({
    view: () => ({ update(view, previous) {
      if (source || replacing || disposed || previous.doc.eq(view.state.doc)) return;
      post.value = splitDocument(post.value).frontmatter + ctx.get(serializerCtx)(view.state.doc);
      persist();
    } }),
  }));
  get("sync").disabled = true;
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
    get("status").textContent = "";
  } catch (error) {
    toggleMode(true);
    get("source-toggle").disabled = true;
    get("status").textContent = `Rich editor unavailable. Markdown writing still works. ${error.message}`;
  }
  ready = true;
  updateSync();
  const destroy = async () => {
    if (disposed) return;
    disposed = true;
    controller.abort();
    await editor?.destroy();
  };
  if (!root.isConnected) await destroy();
  return destroy;
}
