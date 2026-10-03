import { parseDocument, isMap } from 'yaml';

export function splitDocument(text) {
  const match = text.match(/^---\r?\n(?:[\s\S]*?\r?\n)?---(?:\r?\n|$)/);
  return { frontmatter: match?.[0] || '', body: text.slice(match?.[0].length || 0) };
}

function frontmatter(text) {
  const { frontmatter: source } = splitDocument(text);
  if (!source && /^---\r?\n/.test(text)) throw new Error('Close frontmatter with a line containing --- before publishing.');
  if (!source) return { source, data: {} };
  const opening = source.match(/^---\r?\n/)[0];
  const yaml = source.slice(opening.length).replace(/(?:^|\r?\n)---(?:\r?\n|$)$/, '');
  const document = parseDocument(yaml, { uniqueKeys: true });
  const problem = document.errors[0] || document.warnings[0];
  if (problem) throw new Error(`Invalid frontmatter: ${problem.message.split('\n')[0]}`);
  if (document.contents && !isMap(document.contents)) throw new Error('Frontmatter must contain named settings, such as title: "Your title".');
  const data = document.toJS({ maxAliasCount: 100 }) ?? {};
  return { source, data, document, opening };
}

export function readTitle(text) {
  const value = frontmatter(text).data.title;
  if (value == null) return '';
  if (typeof value !== 'string') throw new Error('Use a text title, such as title: "Your title".');
  return value;
}

export function filename(text) {
  const title = readTitle(text);
  if (/\r|\n/.test(title)) throw new Error('Use a single-line frontmatter title, such as title: "Your title".');
  const slug = title.normalize('NFKD').toLowerCase().replace(/\p{M}/gu, '')
    .replace(/['’]/g, '').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
  if (!slug) throw new Error('Add a frontmatter title: "Your title" containing letters or numbers.');
  return slug + '.md';
}

function setField(text, key, value) {
  const parsed = frontmatter(text), { source, document, opening } = parsed;
  const serialized = JSON.stringify(value), { body } = splitDocument(text);
  if (!source) return `---\n${key}: ${serialized}\n---\n\n${body}`;
  const pair = document.contents?.items?.find(item => item.key?.value === key);
  if (!pair && document.contents?.flow) {
    const offset = opening.length + document.contents.range[0] + 1;
    const separator = document.contents.items.length ? ', ' : '';
    return source.slice(0, offset) + `${key}: ${serialized}${separator}` + source.slice(offset) + body;
  }
  if (!pair) return source.replace(/^(---\r?\n)/, prefix => `${prefix}${key}: ${serialized}${source.includes('\r\n') ? '\r\n' : '\n'}`) + body;
  const [start, end] = pair.value.range;
  const offset = opening.length;
  // Replace only the value's source range, retaining comments and every other setting.
  const old = source.slice(offset + start, offset + end);
  const newline = old.match(/\r?\n$/)?.[0] || '';
  const separator = source[offset + start - 1] === ':' ? ' ' : '';
  return source.slice(0, offset + start) + separator + serialized + newline + source.slice(offset + end) + body;
}

export function setTitle(text, title) {
  return setField(text, 'title', title.replace(/\r?\n/g, ' '));
}

export function isDraft(text) {
  const value = frontmatter(text).data.draft;
  return value === true || value === 'true';
}

export function setDraft(text, draft) {
  return setField(text, 'draft', Boolean(draft));
}

export function joinDocument(frontmatter, body) {
  return frontmatter + (frontmatter && !frontmatter.endsWith('\n') ? '\n' : '') + body;
}

// A conservative warning, rather than a growing list of builder-specific syntax.
export function needsSourceMode(original, serialized) {
  const normalize = text => text.replace(/\r\n/g, '\n').replace(/^\n+|\n+$/g, '');
  return normalize(original) !== normalize(serialized);
}
