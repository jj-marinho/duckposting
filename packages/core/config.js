import picomatch from 'picomatch';

export function configuration(options = {}) {
  const config = { branch: 'main', contentRoot: 'content', exclude: [], draftField: 'draft', draftValue: true, filenameFormat: 'title',
    template: '---\ntitle: ""\ndate: {{date}}\ndraft: false\n---\n\n', ...options };
  config.imageDir ??= `${config.contentRoot}/images`;
  config.contentDir ??= `${config.contentRoot}/posts`;
  if (!safePath(config.repository) || !/^[\w-]+\/[\w.-]+$/.test(config.repository)) throw new Error('Configure repository as owner/repository.');
  if (typeof config.branch !== 'string' || !config.branch.trim()) throw new Error('Configure a nonempty GitHub branch.');
  for (const path of [config.contentRoot, config.contentDir, config.imageDir]) {
    if (!safePath(path)) throw new Error('Content paths must be repository-relative directories without . or .. segments.');
  }
  if (config.contentDir !== config.contentRoot && !config.contentDir.startsWith(config.contentRoot + '/')) throw new Error('The new-post directory must be inside contentRoot.');
  if (config.imageBase !== undefined && (typeof config.imageBase !== 'string' || !/^\/(?!\/)(?:[^?#\\\s]*\/)?$/.test(config.imageBase) || config.imageBase.split('/').some(part => ['.', '..'].includes(decodeURIComponent(part))))) throw new Error('imageBase must be a root-relative URL ending in /.');
  if (!config.imageBase && config.imageDir !== config.contentRoot && !config.imageDir.startsWith(config.contentRoot + '/')) throw new Error('An image directory outside contentRoot needs imageBase.');
  if (typeof config.draftField !== 'string' || !/^[A-Za-z_][\w-]*$/.test(config.draftField) || typeof config.draftValue !== 'boolean') throw new Error('Configure a frontmatter draftField and a boolean draftValue.');
  if (!['title', 'date-title'].includes(config.filenameFormat)) throw new Error('filenameFormat must be title or date-title.');
  if (typeof config.template !== 'string') throw new Error('The post template must be Markdown text.');
  if (!Array.isArray(config.exclude) || config.exclude.some(pattern => typeof pattern !== 'string' || !pattern)) throw new Error('exclude must be an array of folder names or glob patterns.');
  if (config.initialPath !== undefined && !contentMatcher(config)(config.initialPath)) throw new Error('initialPath must be an allowed Markdown document inside contentRoot.');
  return config;
}

export function safePath(path) {
  return typeof path === 'string' && Boolean(path) && !/^(?:\/|[A-Za-z]:)/.test(path) && !/[\\\u0000-\u001f]/.test(path)
    && !path.split('/').some(part => ['', '.', '..'].includes(part));
}

export function contentMatcher(config) {
  // Literal names retain the original folder-name behavior; globs are relative to contentRoot.
  const patterns = (config.exclude || []).flatMap(pattern => !/[/*?{}[\]]/.test(pattern)
    ? [`**/${pattern}`, `**/${pattern}/**`] : [pattern]);
  const ignored = patterns.length ? picomatch(patterns, { dot: true }) : () => false;
  return path => safePath(path) && path.startsWith(config.contentRoot + '/') && /\.md$/i.test(path)
    && !ignored(path.slice(config.contentRoot.length + 1));
}
