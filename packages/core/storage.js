export function draftStore(config, storage, onError = () => {}) {
  const namespace = `duck:${config.repository}:${config.branch}:${config.contentDir}:`;
  const access = (key, value) => {
    try {
      if (value === undefined) return storage.getItem(namespace + key);
      if (value === null) storage.removeItem(namespace + key);
      else storage.setItem(namespace + key, value);
      return true;
    } catch { onError(); return false; }
  };
  const parse = key => {
    const raw = access(key);
    try {
      const value = JSON.parse(raw || '{}');
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error();
      return Object.assign(Object.create(null), value);
    } catch {
      // Retain damaged storage for manual recovery before a later save replaces it.
      if (raw) access(`${key}:recovery`, raw);
      onError(); return Object.create(null);
    }
  };
  const drafts = parse('drafts'), known = parse('known');
  for (const [id, draft] of Object.entries(drafts)) {
    if (!draft || typeof draft.text !== 'string' || draft.id !== id || (draft.path && draft.path !== id)) {
      access('drafts:recovery', access('drafts')); delete drafts[id]; onError();
    }
  }
  for (const [path, entry] of Object.entries(known)) {
    if (entry !== null && (!entry || typeof entry.title !== 'string' || typeof entry.draft !== 'boolean')) { delete known[path]; onError(); }
  }
  const old = access('draft');
  if (old) {
    // A distinct entry preserves an older recovery copy when the legacy key has newer text.
    const id = drafts.legacy && drafts.legacy.text !== old ? `legacy:${Date.now()}` : 'legacy';
    drafts[id] = { id, text: old, updated: Date.now() };
    if (access('drafts', JSON.stringify(drafts))) access('draft', null);
  }
  return {
    drafts, known, token: value => access('token', value),
    save(draft) { drafts[draft.id] = { ...draft, updated: Date.now() }; access('drafts', JSON.stringify(drafts)); },
    forget(id) { delete drafts[id]; access('drafts', JSON.stringify(drafts)); },
    mark(path, entry) { known[path] = entry; access('known', JSON.stringify(known)); },
  };
}
