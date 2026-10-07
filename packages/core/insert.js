import { Slice } from '@milkdown/kit/prose/model';
import { TextSelection } from '@milkdown/kit/prose/state';
import { closeHistory } from '@milkdown/kit/prose/history';

// Parse only the inserted fragment, leaving the surrounding document and undo intact.
export function insertFragment(state, selection, doc, block, placeholder) {
  const inline = !block && doc.childCount === 1 && doc.firstChild.type.name === 'paragraph';
  let tr = closeHistory(state.tr).setSelection(selection).replaceSelection(new Slice(doc.content, inline ? 1 : 0, inline ? 1 : 0));
  if (block) {
    let from, to;
    tr.steps.at(-1).getMap().forEach((_a, _b, start, end) => { from = start; to = end; });
    let cursor;
    tr.doc.nodesBetween(from, to, (node, pos) => {
      if (cursor == null && pos >= from && node.isTextblock) cursor = { pos: pos + 1, length: placeholder ? node.content.size : 0 };
    });
    if (cursor) tr = tr.setSelection(TextSelection.create(tr.doc, cursor.pos, cursor.pos + cursor.length));
  }
  return tr.scrollIntoView();
}

export function sourceFragment(markdown, block, placeholder) {
  const text = block ? `\n\n${markdown}\n\n` : markdown;
  const offset = placeholder ? text.indexOf(placeholder) : block && markdown.startsWith('```') ? 6 : text.length;
  return { text, from: offset, to: offset + (placeholder ? placeholder.length : 0) };
}
