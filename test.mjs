import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import assert from "node:assert/strict";
import test from "node:test";

// Run the shipped script with a tiny DOM and simulated GitHub. No network calls.
const script = readFileSync(new URL("./packages/core/document.js", import.meta.url), "utf8").replaceAll("export ", "")
  + readFileSync(new URL("./packages/core/publishing.js", import.meta.url), "utf8").replace(/^import .*\n/, "").replace("export ", "")
  + '\nconnectPublishing(document, { repository: "pato/blog", branch: "main", contentDir: "content/posts", template: "---\\ntitle: \\"\\"\\ndate: {{date}}\\n---\\n\\n" });';

function editor({ request, values = new Map(), blocked = false, source = script } = {}) {
  const nodes = new Map(), calls = [];
  const node = () => ({
    value: "", checked: false, disabled: false, hidden: true, textContent: "", children: [], listeners: {},
    addEventListener(event, callback) { this.listeners[event] = callback; },
    emit(event) { return this.listeners[event](); },
    focus() { this.focused = true; },
    append(child) { this.children.push(child); },
  });
  runInNewContext(source, {
    TextEncoder, btoa,
    document: {
      querySelector(id) { if (!nodes.has(id)) nodes.set(id, node()); return nodes.get(id); },
      createElement: node,
    },
    localStorage: {
      getItem(key) { if (blocked) throw new Error("Blocked"); return values.get(key) ?? null; },
      setItem(key, value) { if (blocked) throw new Error("Blocked"); values.set(key, value); },
      removeItem(key) { if (blocked) throw new Error("Blocked"); values.delete(key); },
    },
    fetch(url, options) {
      calls.push({ url, ...options });
      return request ? request(url, options) : Promise.reject(new Error("Network unavailable"));
    },
  });
  const get = id => nodes.get("#" + id);
  return { get, calls, values,
    input(id, value) { get(id).value = value; return get(id).emit("input"); },
    click(id) { return get(id).emit("click"); },
  };
}

const created = () => new Response(JSON.stringify({ commit: { html_url: "https://github.com/pato/blog/commit/123" } }), { status: 201 });
const rejected = status => new Response(JSON.stringify({ message: "GitHub rejected the request" }), { status });
const draftKey = "duck:pato/blog:main:content/posts:draft";
const tokenKey = "duck:pato/blog:main:content/posts:token";
const text = "---\ntitle: \"João’s ideas!\"\n---\n\n# A different body heading\n\nOlá, Pato 🦆\n<script>untrusted()</script>\n";
function prepare(app, markdown = text) {
  app.input("post", markdown);
  app.input("token", "fake-test-token");
}

test("sanitizes the filename, preserves UTF-8 Markdown, and never sends sha", async () => {
  const app = editor({ request: async () => created() });
  prepare(app, text + "long post 🦆\n".repeat(10000));
  const original = app.get("post").value;
  await app.click("sync");
  assert.equal(app.calls.length, 1);
  assert.equal(app.calls[0].method, "PUT");
  assert.equal(app.calls[0].url, "https://api.github.com/repos/pato/blog/contents/content/posts/joaos-ideas.md");
  const body = JSON.parse(app.calls[0].body);
  assert.equal(Buffer.from(body.content, "base64").toString("utf8"), original);
  assert.equal(body.branch, "main");
  assert.equal(Object.hasOwn(body, "sha"), false);
  assert.equal(app.calls[0].headers.Authorization, "Bearer fake-test-token");
  assert.match(app.get("status").textContent, /Saved to GitHub/);
  assert.equal(app.get("status").children[0].href, "https://github.com/pato/blog/commit/123");
  assert.equal(app.values.has(draftKey), false);
  assert.match(app.get("post").value, /^---\ntitle: ""\ndate: \d{4}-\d{2}-\d{2}\n---\n\n$/);
});

test("restores draft and remembered PAT; Forget only removes PAT", () => {
  const app = editor();
  prepare(app);
  app.get("remember").checked = true;
  app.get("remember").emit("change");
  const reload = editor({ values: app.values });
  assert.equal(reload.get("post").value, text);
  assert.equal(reload.get("token").value, "fake-test-token");
  assert.equal(reload.get("remember").checked, true);
  reload.click("forget");
  assert.equal(reload.values.has(tokenKey), false);
  assert.equal(reload.values.get(draftKey), text);
  assert.equal(reload.get("token").value, "");
});

test("unremembered PAT is not stored; unchecking Remember removes it", () => {
  const app = editor();
  prepare(app);
  assert.equal(app.values.has(tokenKey), false);
  app.get("remember").checked = true;
  app.get("remember").emit("change");
  app.get("remember").checked = false;
  app.get("remember").emit("change");
  assert.equal(app.values.has(tokenKey), false);
});

test("empty, missing, or invalid frontmatter titles are rejected without a request", async () => {
  for (const markdown of [
    "# A body heading", "title: Outside frontmatter",
    "---\ntitle: \"\"\n---\n\nBody", "---\ntitle: \"🦆 !!!\"\n---\n",
    "---\ntitle: >\n  Multiline title\n---\n", "---\ntitle: [Array]\n---\n",
    "---\ntitle: A: B\n---\n", "---\ntitle: \"Unclosed\n---\n",
  ]) {
    const app = editor();
    prepare(app, markdown);
    await app.click("sync");
    assert.equal(app.calls.length, 0);
    assert.equal(app.get("post").value, markdown);
    assert.match(app.get("status").textContent, /frontmatter title/);
  }
});

test("existing different files are read but never overwritten", async () => {
  const app = editor({ request: async (_, options) => options.method === "PUT" ? rejected(422) : new Response("# Existing post") });
  prepare(app);
  await app.click("sync");
  assert.equal(app.calls.length, 2);
  assert.match(app.calls[1].url, /\?ref=main$/);
  assert.equal(app.calls[1].cache, "no-store");
  assert.equal(app.calls[1].method, undefined);
  assert.equal(app.values.get(draftKey), text);
  assert.match(app.get("status").textContent, /Change the frontmatter title/);
});

test("lost responses and server errors reconcile without another create", async () => {
  for (const code of [0, 500, 503]) {
    const app = editor({ request: async (_, options) => {
      if (options.method !== "PUT") return new Response(text);
      if (code) return rejected(code);
      throw new TypeError("Response lost after commit");
    } });
    prepare(app);
    await app.click("sync");
    assert.equal(app.calls.filter(call => call.method === "PUT").length, 1);
    assert.match(app.get("status").textContent, /Saved to GitHub/);
    assert.equal(app.values.has(draftKey), false);
  }
});

test("retry after reload recognizes content saved during a lost response", async () => {
  const offline = editor();
  prepare(offline);
  await offline.click("sync");
  assert.equal(offline.values.get(draftKey), text);
  assert.equal(offline.get("post").disabled, false);
  const retry = editor({ values: offline.values, request: async (_, options) => options.method === "PUT" ? rejected(422) : new Response(text) });
  retry.input("token", "fake-test-token");
  await retry.click("sync");
  assert.match(retry.get("status").textContent, /Saved to GitHub/);
  assert.equal(retry.calls.filter(call => call.method === "PUT").length, 1);
});

test("denied/expired credentials and rate limits preserve writing", async () => {
  for (const code of [401, 403, 404, 429]) {
    const app = editor({ request: async () => rejected(code) });
    prepare(app);
    await app.click("sync");
    assert.equal(app.calls.length, 1);
    assert.equal(app.values.get(draftKey), text);
    assert.equal(app.get("post").value, text);
    assert.equal(app.get("sync").disabled, false);
  }
});

test("repeated clicks send only one create request", async () => {
  let finish;
  const app = editor({ request: () => new Promise(resolve => { finish = resolve; }) });
  prepare(app);
  const first = app.click("sync");
  await app.click("sync");
  assert.equal(app.calls.length, 1);
  assert.equal(app.get("post").disabled, true);
  finish(created());
  await first;
  assert.equal(app.get("sync").disabled, false);
});

test("blocked storage shows a notice without preventing writing or sync", async () => {
  const app = editor({ blocked: true, request: async () => created() });
  prepare(app);
  assert.equal(app.get("storage-warning").hidden, false);
  await app.click("sync");
  assert.match(app.get("status").textContent, /Saved to GitHub/);
});

test("new templates substitute dates; restored Markdown stays untouched", () => {
  const app = editor();
  const today = new Date();
  const date = [today.getFullYear(), today.getMonth() + 1, today.getDate()].map(value => String(value).padStart(2, "0")).join("-");
  assert.equal(app.get("post").value, `---\ntitle: ""\ndate: ${date}\n---\n\n`);
  const draft = '---\ntitle: "My draft"\n---\n\n{{date}}';
  app.input("post", draft);
  assert.equal(editor({ values: app.values }).get("post").value, draft);
});

test("plain and quoted frontmatter titles produce safe filenames", async () => {
  for (const [title, name] of [
    ["João’s ideas! # comment", "joaos-ideas.md"],
    ["'Pato''s notes' # comment", "patos-notes.md"],
    ['"My \\"quoted\\" title: yes" # comment', "my-quoted-title-yes.md"],
    ['"../../outside"', "outside.md"],
  ]) {
    const app = editor({ request: async () => created() });
    prepare(app, `---\ntitle: ${title}\n---\n\nWriting.`);
    await app.click("sync");
    assert.equal(app.calls.length, 1);
    assert.equal(app.calls[0].url, `https://api.github.com/repos/pato/blog/contents/content/posts/${name}`);
  }
});

test("an older in-flight save does not remove a newer draft", async () => {
  let finish;
  const app = editor({ request: () => new Promise(resolve => finish = resolve) });
  prepare(app);
  const pending = app.click("sync");
  // A new writing instance can start while the original tab navigates away.
  app.values.set(draftKey, text + "A newer draft.\n");
  finish(created());
  await pending;
  assert.equal(app.values.get(draftKey), text + "A newer draft.\n");
});
