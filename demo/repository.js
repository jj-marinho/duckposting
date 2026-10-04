import { readTitle, isDraft } from './editor.js';
const key = 'duckposting-demo:repository';
const initial = {
  'notes/about.md': '---\ntitle: "About this sandbox"\ndraft: false\n---\n\nNothing here is sent to GitHub. Write, edit and publish locally.\n',
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
