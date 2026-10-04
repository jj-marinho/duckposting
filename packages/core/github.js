import { contentMatcher } from './config.js';
import { imageMatcher, maxImageSize } from './images.js';
// Contents handles one file per commit. Trees list paths without downloading posts.
export function github(config, token, request = fetch, { signal, timeout = 30000 } = {}) {
  const base = `https://api.github.com/repos/${config.repository}`;
  const pathURL = path => `${base}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;
  const allowed = contentMatcher(config), allowedImage = imageMatcher(config);
  let imagePaths = [];
  const ensureImage = path => { if (!allowedImage(path)) throw new Error('This image is outside the configured content.'); };
  const ensurePath = path => { if (!allowed(path)) throw new Error('This file is outside the configured Markdown content.'); };
  async function call(url, options = {}, raw = false) {
    const response = await request(url, { signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(timeout)]), cache: 'no-store', ...options, headers: {
      Authorization: `Bearer ${token()}`, Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2026-03-10', ...options.headers,
    } });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const error = new Error(data.message || `GitHub returned ${response.status}.`);
      error.status = response.status;
      throw error;
    }
    return raw ? response.blob() : response.status === 204 ? null : response.json();
  }
  const read = async path => {
    ensurePath(path);
    const data = await call(`${pathURL(path)}?ref=${encodeURIComponent(config.branch)}`);
    if (data.type && data.type !== 'file' || data.encoding && data.encoding !== 'base64' || typeof data.content !== 'string' || typeof data.sha !== 'string') throw new Error('Only Markdown files below GitHub’s inline content limit can be edited.');
    const bytes = Uint8Array.from(atob(data.content.replace(/\s/g, '')), char => char.charCodeAt(0));
    const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
    if (text.startsWith('\uFEFF')) throw new Error('Save this Markdown as UTF-8 without a byte order mark before editing.');
    return { text, sha: data.sha };
  };
  const readImage = async path => {
    ensureImage(path);
    return call(`${pathURL(path)}?ref=${encodeURIComponent(config.branch)}`, { headers: { Accept: 'application/vnd.github.raw+json' } }, true);
  };
  let busy = false;
  async function change(path, text, sha, remove = false, image = false) {
    if (image) { ensureImage(path); if (!path.startsWith(config.imageDir + '/') || !text.length || text.length > maxImageSize) throw new Error('Choose an image below 10 MB in the configured image directory.'); }
    else ensurePath(path);
    if (remove && !sha) throw new Error('A file revision is required for deletion.');
    if (busy) throw new Error('Another action is still running.');
    busy = true;
    try {
      let binary = '';
      const bytes = image ? text : new TextEncoder().encode(text);
      for (let offset = 0; offset < bytes.length; offset += 32768) binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
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
            if (image) {
              const bytes = new Uint8Array(await (await readImage(path)).arrayBuffer());
              if (bytes.length === text.length && bytes.every((byte, index) => byte === text[index])) return {};
              throw new Error('This image filename already exists.');
            }
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
    read, readImage, saveImage: (path, bytes) => change(path, bytes, undefined, false, true),
    get imagePaths() { return imagePaths; },
    save: (path, text, sha) => change(path, text, sha),
    remove: (path, sha) => change(path, '', sha, true),
    async list() {
      const data = await call(`${base}/git/trees/${encodeURIComponent(config.branch)}?recursive=1`);
      if (data.truncated) throw new Error('Repository listing is too large to show safely.');
      if (!Array.isArray(data.tree)) throw new Error('GitHub returned an invalid repository listing.');
      imagePaths = data.tree.filter(file => file.type === 'blob' && file.mode !== '120000' && allowedImage(file.path)).map(file => file.path);
      return data.tree.filter(file => file.type === 'blob' && file.mode !== '120000' && allowed(file.path));
    },
  };
}
