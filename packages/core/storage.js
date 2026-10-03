export function draftStore(config, storage, onError = () => {}) {
  const namespace = `duck:${config.repository}:${config.branch}:${config.contentDir}:`;
  const access = (key, value) => {
    try {
      if (value === undefined) return storage.getItem(namespace + key);
      if (value === null) storage.removeItem(namespace + key);
      else storage.setItem(namespace + key, value);
    } catch { onError(); }
  };
  const parse = key => { try { return JSON.parse(access(key) || '{}'); } catch { onError(); return {}; } };
  const drafts = parse('drafts'), known = parse('known');
  const old = access('draft');
  if (old) {
    drafts.legacy ??= { id: 'legacy', text: old, updated: Date.now() };
    access('drafts', JSON.stringify(drafts));
    // Retain the original if migration could not be written.
    if (access('drafts')) access('draft', null);
  }
  return {
    drafts, known, token: value => access('token', value),
    save(draft) { drafts[draft.id] = { ...draft, updated: Date.now() }; access('drafts', JSON.stringify(drafts)); },
    forget(id) { delete drafts[id]; access('drafts', JSON.stringify(drafts)); },
    mark(path, entry) { known[path] = entry; access('known', JSON.stringify(known)); },
  };
}
