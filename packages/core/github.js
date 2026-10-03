// Contents handles one file per commit. Trees list paths without downloading posts.
export function github(config, token, request = fetch) {
  const base = `https://api.github.com/repos/${config.repository}`;
  const pathURL = path => `${base}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;
  async function call(url, options = {}) {
    const response = await request(url, { cache: 'no-store', ...options, headers: {
      Authorization: `Bearer ${token()}`, Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2026-03-10', ...options.headers,
    } });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const error = new Error(data.message || `GitHub returned ${response.status}.`);
      error.status = response.status;
      throw error;
    }
    return response.status === 204 ? null : response.json();
  }
  const read = async path => {
    const data = await call(`${pathURL(path)}?ref=${encodeURIComponent(config.branch)}`);
    const bytes = Uint8Array.from(atob(data.content.replace(/\s/g, '')), char => char.charCodeAt(0));
    return { text: new TextDecoder().decode(bytes), sha: data.sha };
  };
  let busy = false;
  async function change(path, text, sha, remove = false) {
    if (busy) throw new Error('Another action is still running.');
    busy = true;
    try {
      let binary = '';
      for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
      try {
        const data = await call(pathURL(path), { method: remove ? 'DELETE' : 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ branch: config.branch, message: `${remove ? 'Delete' : sha ? 'Update' : 'Add'} ${path}`,
            ...(remove ? {} : { content: btoa(binary) }), ...(sha ? { sha } : {}) }),
        });
        return { sha: data.content?.sha, url: data.commit?.html_url };
      } catch (error) {
        if (!error.status || [409, 422].includes(error.status) || error.status >= 500) {
          try {
            const file = await read(path);
            if (!remove && file.text === text) return { sha: file.sha };
            if (!sha && !remove) error.message = 'This filename already exists. Change the title or edit that post.';
          } catch (check) {
            if (remove && check.status === 404) return {};
          }
        }
        throw error;
      }
    } finally { busy = false; }
  }
  return {
    read, save: (path, text, sha) => change(path, text, sha),
    remove: (path, sha) => change(path, '', sha, true),
    async list() {
      const data = await call(`${base}/git/trees/${encodeURIComponent(config.branch)}?recursive=1`);
      if (data.truncated) throw new Error('Repository listing is too large to show safely.');
      return data.tree.filter(file => file.type === 'blob' && file.path.startsWith(config.contentRoot + '/') && /\.md$/i.test(file.path)
        && !file.path.slice(config.contentRoot.length + 1).split('/').some(part => config.exclude.includes(part)));
    },
  };
}
