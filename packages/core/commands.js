import { safePath } from './config.js';

// Commands are writing helpers. Only ordinary Markdown is stored.
export const commands = [
  { id: 'page', label: 'Link page', search: 'link page post' },
  { id: 'url', label: 'Link URL', search: 'link url website' },
  { id: 'image', label: 'Image', search: 'image photo upload' },
  { id: 'code', label: 'Code block', search: 'code block', markdown: '```\n\n```' },
  { id: 'math', label: 'Math block', search: 'math block equation latex' },
  { id: 'table', label: 'Table block', search: 'table block', markdown: '| Column 1 | Column 2 |\n| --- | --- |\n|  |  |\n|  |  |', placeholder: 'Column 1' },
];
export const matchingCommands = query => commands.filter(command => command.search.includes(query.toLowerCase().trim()));
export function commandQuery(before) {
  const match = /(?:^|\s)\/([a-z ]{0,32})$/i.exec(before);
  return match ? { query: match[1], length: match[1].length + 1 } : null;
}
export function sourceCommandQuery(text, end) {
  const before = text.slice(0, end);
  let fence;
  for (const line of before.split('\n')) {
    const match = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (match) {
      if (!fence) fence = match[1];
      else if (match[1][0] === fence[0] && match[1].length >= fence.length) fence = undefined;
    }
  }
  if (fence || (before.split('\n').at(-1).match(/`/g)?.length || 0) % 2) return null;
  return commandQuery(before.split('\n').at(-1));
}
const label = value => String(value).replace(/[\r\n]/g, ' ').replace(/[\\[\]`*_<>$~]/g, '\\$&');
export function linkMarkdown(title, href) {
  if (!href || /[\u0000-\u001f\u007f\\]/.test(href)) throw new Error('Enter a valid link.');
  return `[${label(title || href)}](<${href.replace(/</g, '%3C').replace(/>/g, '%3E')}>)`;
}
export function externalLink(value) {
  const href = value.trim();
  let url;
  try { url = new URL(href); } catch { throw new Error('Use an http(s) URL or mailto link.'); }
  if (!['http:', 'https:', 'mailto:'].includes(url.protocol) || /[\u0000-\u001f\u007f\\]/.test(href)) throw new Error('Use an http(s) URL or mailto link.');
  return url.href;
}
export function pageHref(path, contentRoot) {
  if (!safePath(path) || !path.startsWith(contentRoot + '/') || !/\.md$/i.test(path)) throw new Error('Choose a Markdown page inside this blog.');
  return path.slice(contentRoot.length + 1).split('/').map(encodeURIComponent).join('/');
}
export function matchingPages(pages, query) {
  const words = query.toLowerCase().trim().split(/\s+/);
  return pages.filter(page => words.every(word => `${page.title} ${page.path}`.toLowerCase().includes(word)));
}
