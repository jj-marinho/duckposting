import { safePath, contentMatcher } from './config.js';

export const imageExtensions = /\.(?:png|jpe?g|gif|webp|avif)$/i;
export const maxImageSize = 10 * 1024 * 1024;
export const imageMatcher = config => {
  const markdown = contentMatcher(config);
  return path => safePath(path) && imageExtensions.test(path) && (path.startsWith(config.imageDir + '/') && !path.startsWith(config.contentRoot + '/') || markdown(path.replace(imageExtensions, '.md')));
};
export function imagePath(config, file, id = crypto.randomUUID()) {
  if (!imageExtensions.test(file.name)) throw new Error('Choose a PNG, JPEG, GIF, WebP or AVIF image.');
  if (!file.size || file.size > maxImageSize) throw new Error('Choose an image smaller than 10 MB.');
  const extension = file.name.match(imageExtensions)[0].toLowerCase();
  const name = file.name.slice(0, -extension.length).normalize('NFKD').toLowerCase().replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'image';
  return `${config.imageDir}/${name.slice(0, 60)}-${id}${extension}`;
}
export function imageURL(value) {
  const url = String(value).trim();
  if (!url || /[\u0000-\u001f\u007f]/.test(url) || /^\/\//.test(url) || /\\/.test(url) || /^[a-z][a-z\d+.-]*:/i.test(url) && !/^https?:\/\//i.test(url)) throw new Error('Use an http(s) image URL or a path within the blog.');
  return url;
}
export function imageTarget(config, src, postPath, paths = []) {
  src = imageURL(src);
  if (/^https?:\/\//i.test(src)) return { url: src };
  const separator = src.search(/[?#]/);
  const raw = separator < 0 ? src : src.slice(0, separator), suffix = separator < 0 ? '' : src.slice(separator);
  const target = decodeURIComponent(raw).replace(/^\/+/, '');
  const deployed = config.images?.find(image => image.url === raw);
  if (deployed) return { path: deployed.path, url: deployed.url + suffix };
  if (config.imageBase && raw.startsWith(config.imageBase)) {
    const path = `${config.imageDir}/${decodeURIComponent(raw.slice(config.imageBase.length))}`;
    if (!imageMatcher(config)(path)) throw new Error('Use an image path within the configured image directory.');
    return { path, url: raw + suffix };
  }
  if (raw.startsWith('/')) return { url: src };
  const candidates = [...(config.images || []).map(image => image.path), ...paths];
  const relative = postPath?.slice(0, postPath.lastIndexOf('/') + 1) || config.contentDir + '/';
  const normalize = path => { const parts = []; for (const part of path.split('/')) { if (part === '..') parts.pop(); else if (part && part !== '.') parts.push(part); } return parts.join('/'); };
  const exact = normalize(relative + decodeURIComponent(raw));
  const matches = [...new Set(candidates.filter(path => path.endsWith('/' + target)))];
  const path = /^(?:\.\.?\/)/.test(raw) ? exact : matches.length === 1 ? matches[0] : `${config.contentRoot}/${target}`;
  if (!imageMatcher(config)(path)) throw new Error('Use an image path within the blog content directory.');
  const known = config.images?.find(image => image.path === path);
  if (config.imageBase && path.startsWith(config.imageDir + '/')) return { path, url: (known?.url || config.imageBase + path.slice(config.imageDir.length + 1).split('/').map(encodeURIComponent).join('/')) + suffix };
  const local = path.slice(config.contentRoot.length + 1).split('/').map(segment => encodeURIComponent(segment.replace(/\s/g, '-'))).join('/');
  return { path, url: (known?.url || `${config.siteBase || '/'}${local}`) + suffix };
}
export function imageMarkdown(src, alt = '') {
  return `![${alt.replace(/[\r\n]/g, ' ').replace(/[\\[\]]/g, '\\$&')}](<${imageURL(src).replace(/>/g, '%3E').replace(/</g, '%3C')}>)`;
}

// CommonMark omits optional image strings; Milkdown's schema validates strings.
export const parseImage = (state, node, type) => state.addNode(type, {
  src: node.url, alt: node.alt ?? '', title: node.title ?? '',
});
