import { readTitle, isDraft } from './editor.js';
const key = 'duckposting-demo:repository';
const initial = {
  'notes/about.md': `---
title: "Your blog. Your words."
date: ${new Date().toISOString().slice(0, 10)}
draft: false
---

This page is already the editor. Click here and start writing.

**duckposting** adds a small Markdown editor to the blog you already own. Open /write, write, and Publish. GitHub stores the file; your existing site builder does the rest.

No application server, editor account, or browser extension. Just your title, date, and words, styled by your own site.

## Try it here

Change this introduction, type / to insert a link, image, code block, equation, or table, or switch to Markdown below. Publish saves only in this browser. All content opens the sample posts and drafts.

Inline math looks like $E = mc^2$. Everything remains ordinary Markdown.

## Bring it to your blog

One package, with adapters for Quartz 5, static Astro, and Jekyll posts. Early alpha; not yet published to npm.

[Read the docs](/duckposting/docs/) · [Explore the source](https://github.com/jj-marinho/duckposting)
`,
  'notes/posts/hello.md': '---\ntitle: "Hello, duckposting"\ndraft: false\n---\n\nA small editor for a small blog.\n',
  'notes/posts/unfinished.md': '---\ntitle: "An unfinished thought"\ndraft: true\n---\n\nA draft already saved in the pretend repository.\n',
};
export function demoRepository(storage) {
  let files;
  try { files = JSON.parse(storage.getItem(key) || 'null'); } catch {}
  files ||= Object.fromEntries(Object.entries(initial).map(([path, text]) => [path, { text, sha: path }]));
  const persist = () => { try { storage.setItem(key, JSON.stringify(files)); } catch {} };
  const encode = text => { let binary = ''; for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte); return btoa(binary); };
  const json = (data, status = 200) => new Response(JSON.stringify(data), { status });
  const request = async (url, options = {}) => {
    if (url === '/demo-content.json') return json(Object.entries(files).filter(([path, file]) => path.endsWith('.md') && !isDraft(file.text)).map(([path, file]) => ({ path, title: readTitle(file.text), draft: false })));
    if (!url.startsWith('https://api.github.com/repos/demo/local/')) throw new Error('The sandbox refuses network requests.');
    if (url.includes('/git/trees/')) return json({ tree: Object.entries(files).map(([path, file]) => ({ path, sha: file.sha, type: 'blob', mode: '100644' })) });
    const path = decodeURIComponent(new URL(url).pathname.split('/contents/')[1]), file = files[path];
    if (!options.method && options.headers?.Accept === 'application/vnd.github.raw+json') return file ? new Response(Uint8Array.from(atob(file.base64 || encode(file.text)), char => char.charCodeAt(0))) : json({}, 404);
    if (!options.method) return file ? json({ type: 'file', encoding: 'base64', content: encode(file.text), sha: file.sha }) : json({}, 404);
    const data = JSON.parse(options.body);
    if (file ? data.sha !== file.sha : Boolean(data.sha)) return json({ message: 'A file with this name already exists.' }, 422);
    if (options.method === 'DELETE') delete files[path];
    else files[path] = path.endsWith('.md') ? { text: new TextDecoder().decode(Uint8Array.from(atob(data.content), char => char.charCodeAt(0))), sha: crypto.randomUUID() } : { base64: data.content, sha: crypto.randomUUID() };
    persist();
    return json({ content: files[path] || null, commit: { html_url: '#sandbox' } });
  };
  return { request, reset() { storage.removeItem(key); } };
}
