import { Editor, rootCtx, defaultValueCtx, editorViewCtx, serializerCtx } from "@milkdown/kit/core";
import { commonmark, toggleStrongCommand, toggleEmphasisCommand, wrapInHeadingCommand, wrapInBulletListCommand } from "@milkdown/kit/preset/commonmark";
import { history } from "@milkdown/kit/plugin/history";
import { $prose, callCommand, replaceAll } from "@milkdown/kit/utils";
import { Plugin } from "@milkdown/kit/prose/state";
import { splitDocument, readTitle, setTitle } from "./document.js";
import { connectPublishing } from "./publishing.js";
import "@milkdown/kit/prose/view/style/prosemirror.css";
import "./style.css";

// Host provides the article-shaped root. All controls stay inside this instance.
export async function mountDuckposting(root, config) {
  root.classList.add("duckposting");
  root.innerHTML = `
    <h1 class="article-title" id="title" contenteditable="plaintext-only" role="textbox" aria-label="Post title" data-placeholder="Your title"></h1>
    <div class="duck-toolbar" role="toolbar" aria-label="Formatting">
      <button type="button" data-command="bold" title="Bold (⌘/Ctrl+B)">Bold</button>
      <button type="button" data-command="italic" title="Italic (⌘/Ctrl+I)">Italic</button>
      <button type="button" data-command="heading">Heading</button>
      <button type="button" data-command="list">List</button>
      <span class="duck-hint">Markdown shortcuts work as you type.</span>
    </div>
    <article class="popover-hint" id="body" aria-label="Post body"></article>
    <div class="duck-controls">
      <button id="source-toggle" type="button" aria-pressed="false">Markdown</button>
      <label for="post" id="source-label" hidden>Markdown source (including frontmatter)</label>
      <textarea id="post" hidden spellcheck="true" aria-describedby="status"></textarea>
      <details id="metadata"><summary>Post settings</summary>
        <label for="frontmatter">Frontmatter</label>
        <textarea id="frontmatter" spellcheck="false"></textarea>
      </details>
      <details id="connection"><summary>GitHub connection</summary>
        <label for="token">Personal access token</label>
        <input id="token" type="password" autocomplete="off" spellcheck="false">
        <label><input id="remember" type="checkbox"> Remember on this device</label>
        <button id="forget" type="button">Forget</button>
      </details>
      <button id="sync" type="button">Sync</button>
      <p id="status" role="status" aria-live="polite">Loading editor…</p>
      <p id="storage-warning" role="status" hidden>Local saving is unavailable. Keep this tab open to preserve your draft.</p>
    </div>`;

  const get = id => root.querySelector(`#${id}`);
  const post = get("post"), title = get("title"), body = get("body"), metadata = get("frontmatter");
  const controller = new AbortController();
  const { signal } = controller;
  let editor, source = false, replacing = false, disposed = false;
  const persist = () => post.dispatchEvent(new Event("input"));
  const renderFields = () => {
    try { title.textContent = readTitle(post.value); } catch { title.textContent = ""; }
    metadata.value = splitDocument(post.value).frontmatter;
  };
  const toggleMode = raw => {
    source = raw;
    post.hidden = get("source-label").hidden = !raw;
    title.hidden = body.hidden = root.querySelector(".duck-toolbar").hidden = get("metadata").hidden = raw;
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
  connectPublishing(root, config, {
    signal, onReset: reset,
    onBusy(busy) {
      if (disposed) return;
      title.contentEditable = busy ? "false" : "plaintext-only";
      metadata.disabled = busy;
      root.querySelectorAll(".duck-toolbar button, #source-toggle").forEach(button => button.disabled = busy);
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
    }).use(commonmark).use(history).use(autosave).create();
    const view = editor.action(ctx => ctx.get(editorViewCtx));
    view.dom.setAttribute("role", "textbox");
    view.dom.setAttribute("aria-label", "Post body");
    view.dom.setAttribute("aria-multiline", "true");
    view.dom.setAttribute("data-placeholder", "Start writing…");
    const commands = { bold: toggleStrongCommand, italic: toggleEmphasisCommand, heading: wrapInHeadingCommand, list: wrapInBulletListCommand };
    root.querySelectorAll("[data-command]").forEach(button => {
      on(button, "mousedown", event => event.preventDefault());
      on(button, "click", () => {
        editor.action(callCommand(commands[button.dataset.command].key, button.dataset.command === "heading" ? 2 : undefined));
        view.focus();
      });
    });
    get("status").textContent = "";
  } catch (error) {
    toggleMode(true);
    get("source-toggle").disabled = true;
    get("status").textContent = `Rich editor unavailable. Markdown writing still works. ${error.message}`;
  }
  get("sync").disabled = false;
  const destroy = async () => {
    if (disposed) return;
    disposed = true;
    controller.abort();
    await editor?.destroy();
  };
  if (!root.isConnected) await destroy();
  return destroy;
}
