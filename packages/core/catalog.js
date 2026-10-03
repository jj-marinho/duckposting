import { contentMatcher } from './config.js';
import { readTitle } from './document.js';

export function publishedIndex(data, config) {
  const allowed = contentMatcher(config);
  if (!Array.isArray(data) || data.some(entry => !entry || !allowed(entry.path) || typeof entry.title !== 'string')) {
    throw new Error('The published index must contain content paths and text titles.');
  }
  return data.map(({ path, title }) => ({ path, title, draft: false }));
}

export function contentEntries(config, published, files, store) {
  const allowed = contentMatcher(config), metadata = new Map(published.map(entry => [entry.path, entry]));
  for (const [path, entry] of Object.entries(store.known)) {
    if (!allowed(path)) continue;
    if (entry) metadata.set(path, entry); else metadata.delete(path);
  }
  const listed = new Map((files || [...metadata.values()]).filter(file => allowed(file.path) && store.known[file.path] !== null).map(file => [file.path, file]));
  // Cached exact-document changes remain recoverable even without credentials or an index.
  for (const draft of Object.values(store.drafts)) if (draft.path && allowed(draft.path) && !listed.has(draft.path)) listed.set(draft.path, { path: draft.path });
  return [...listed.values()].map(file => {
    let title = file.path.split('/').pop().replace(/\.md$/i, '').replace(/[-_]/g, ' ');
    try { title = readTitle(store.drafts[file.path]?.text || '') || title; } catch {}
    return { title, draft: true, ...file, ...metadata.get(file.path), path: file.path };
  }).sort((a, b) => a.title.localeCompare(b.title));
}
