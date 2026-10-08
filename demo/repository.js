import { readTitle, isDraft } from './editor.js';
const key = 'duckposting-demo:repository';
const historyKey = 'duckposting-demo:history';
const initial = {
  'notes/about.md': `---
title: "duckposting"
date: ${new Date().toISOString().slice(0, 10)}
draft: false
---
I created this because I wanted to write on my phone without paying for an actual CMS. My brain really hates friction, so hopefully this makes me write more!

Hey, this is a small CMS that runs in your browser with a single GitHub PAT. Add \`/write\` to your blog, write, and Publish. It saves Markdown to your repo, and your usual site build takes it from there.

This page is the editor. Click into the text and try it. Publishing here only saves in this browser.

## Here's what you can do

### Write

* Bullet lists
* **Bold**, *italics*, and ~~strikethrough~~
* Numbered lists, headings, and quotes
* Plain Markdown whenever you want: use the switch below

1. Open your blog on your phone.
2. Write something.
3. Publish.

> The point is to get the words down.

### Check things off

* [x] Build a small editor
* [ ] Write more often
* [ ] Finish that half-written post

Click a checkbox to change it. To start a checklist, type \`- [ ] \` with a space at the end.

### Make tables

| Thing        | Where it lives                  |
| ------------ | ------------------------------- |
| Your writing | Markdown files                  |
| Your posts   | Your GitHub repo                |
| Your drafts  | This browser, until you publish |

Click into a table to add or remove rows and columns with its buttons.

### Add code

\`\`\`javascript
const idea = "just write";
console.log(idea);
\`\`\`

Choose a language from the block's menu. Your site handles syntax highlighting after publication.

### Write equations

Inline LaTeX: $E = mc^2$.

Or a whole block:

$$
a^2 + b^2 = c^2
$$

Click an equation to edit it. Your blog needs math rendering enabled to show it after publication.

### Add images and links

Type \`/\` or tap **Insert /** for six helpers: **Link page**, **Link URL**, **Image**, **Code block**, **Math block**, and **Table block**.

Link page lets you search your blog's pages instead of remembering their URLs. Link URL works for web links and email addresses.

Images can come from a URL, a file picker, clipboard paste, or a file drop. Uploads accept PNG, JPEG, GIF, WebP, and AVIF. On your blog, an upload saves the image to GitHub immediately; publishing the post is a separate step.

### Manage your posts

**All content** opens the page list: create, edit, or delete one post at a time. Local drafts sit at the top, ready to resume or discard. They're saved as you type, with one local draft per existing post.

Use **Draft** to keep a committed post out of the blog. Change the title and date directly; extra frontmatter lives under **Post settings**.

The version selector below shows your local draft and the post's GitHub commits. Browse an older version without losing your writing, then restore it if you want.

Clearing website data removes local drafts and a remembered PAT. Anything committed to GitHub stays there.

## Put it on your blog

The editor uses your site's styling. Pick your builder for its setup guide:

* [Astro](/duckposting/docs/astro)
* [Quartz 5](/duckposting/docs/quartz)
* [Jekyll](/duckposting/docs/jekyll)

Use a fine-grained GitHub PAT limited to your blog repo, with **Contents: read and write**. Keep it in the editor's connection settings, never in your code.

This is still an alpha, and it isn't on npm yet. The guides explain how to install the package from source for now.

[Source code](https://github.com/jj-marinho/duckposting) · [Docs](/duckposting/docs/) · [Issues](https://github.com/jj-marinho/duckposting/issues)
`,
  'notes/posts/hello.md': '---\ntitle: "Hello, duckposting"\ndraft: false\n---\n\nA small editor for a small blog.\n',
  'notes/posts/unfinished.md': '---\ntitle: "An unfinished thought"\ndraft: true\n---\n\nA draft already saved in the pretend repository.\n',
};
export function demoRepository(storage) {
  let files;
  try { files = JSON.parse(storage.getItem(key) || 'null'); } catch {}
  files ||= Object.fromEntries(Object.entries(initial).map(([path, text]) => [path, { text, sha: path }]));
  let versions;
  try { versions = JSON.parse(storage.getItem(historyKey) || 'null'); } catch {}
  versions ||= Object.fromEntries(Object.entries(files).filter(([path]) => path.endsWith('.md')).map(([path, file], index) => [path, [{ ...file, commit: (index + 1).toString(16).padEnd(40, '0'), message: `Add ${path}`, date: new Date().toISOString() }]]));
  const persist = () => { try { storage.setItem(key, JSON.stringify(files)); storage.setItem(historyKey, JSON.stringify(versions)); } catch {} };
  const encode = text => { let binary = ''; for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte); return btoa(binary); };
  const json = (data, status = 200) => new Response(JSON.stringify(data), { status });
  const request = async (url, options = {}) => {
    if (url === '/demo-content.json') return json(Object.entries(files).filter(([path, file]) => path.endsWith('.md') && !isDraft(file.text)).map(([path, file]) => ({ path, title: readTitle(file.text), draft: false })));
    if (!url.startsWith('https://api.github.com/repos/demo/local/')) throw new Error('The sandbox refuses network requests.');
    if (url.includes('/git/trees/')) return json({ tree: Object.entries(files).map(([path, file]) => ({ path, sha: file.sha, type: 'blob', mode: '100644' })) });
    const target = new URL(url);
    if (target.pathname.endsWith('/commits')) {
      const page = Number(target.searchParams.get('page') || 1);
      return json((versions[target.searchParams.get('path')] || []).slice((page - 1) * 30, page * 30).map(version => ({ sha: version.commit, commit: { message: version.message, committer: { date: version.date } } })));
    }
    const path = decodeURIComponent(target.pathname.split('/contents/')[1]);
    const revision = target.searchParams.get('ref');
    const file = revision && revision !== 'main' ? versions[path]?.find(version => version.commit === revision) : files[path];
    if (!options.method && options.headers?.Accept === 'application/vnd.github.raw+json') return file ? new Response(Uint8Array.from(atob(file.base64 || encode(file.text)), char => char.charCodeAt(0))) : json({}, 404);
    if (!options.method) return file ? json({ type: 'file', encoding: 'base64', content: encode(file.text), sha: file.sha }) : json({}, 404);
    const data = JSON.parse(options.body);
    if (file ? data.sha !== file.sha : Boolean(data.sha)) return json({ message: 'A file with this name already exists.' }, 422);
    if (options.method === 'DELETE') delete files[path];
    else files[path] = path.endsWith('.md') ? { text: new TextDecoder().decode(Uint8Array.from(atob(data.content), char => char.charCodeAt(0))), sha: crypto.randomUUID() } : { base64: data.content, sha: crypto.randomUUID() };
    if (options.method !== 'DELETE' && path.endsWith('.md')) (versions[path] ||= []).unshift({ ...files[path], commit: crypto.randomUUID().replaceAll('-', '').padEnd(40, '0'), message: data.message, date: new Date().toISOString() });
    persist();
    return json({ content: files[path] || null, commit: { html_url: '#sandbox' } });
  };
  return { request, reset() { storage.removeItem(key); storage.removeItem(historyKey); } };
}
