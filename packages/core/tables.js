import { $view } from '@milkdown/kit/utils';
import { tableSchema, addRowWithAlignment } from '@milkdown/kit/preset/gfm';
import { TableMap, addColumnAfter } from '@milkdown/kit/prose/tables';
import { TextSelection } from '@milkdown/kit/prose/state';
import { closeHistory } from '@milkdown/kit/prose/history';

export function appendTable(state, ctx, pos, axis) {
  const table = state.doc.nodeAt(pos);
  if (table?.type.name !== 'table') return null;
  const map = TableMap.get(table);
  let tr;
  if (axis === 'row') {
    tr = addRowWithAlignment(ctx, closeHistory(state.tr), { map, tableStart: pos + 1, table }, map.height);
  } else {
    const edge = pos + 1 + map.map[map.width - 1] + 2;
    const selected = state.apply(state.tr.setSelection(TextSelection.create(state.doc, edge)));
    addColumnAfter(selected, result => { tr = closeHistory(result); });
  }
  if (!tr) return null;
  const next = TableMap.get(tr.doc.nodeAt(pos));
  const cell = next.map[axis === 'row' ? (next.height - 1) * next.width : next.width - 1];
  return tr.setSelection(TextSelection.create(tr.doc, pos + 1 + cell + 2)).scrollIntoView();
}

// Controls belong to their table, including when another table holds the cursor.
export const tableTools = $view(tableSchema.node, ctx => (node, view, getPos) => {
  const dom = document.createElement('div'), table = document.createElement('table'), contentDOM = document.createElement('tbody'), tools = document.createElement('div');
  dom.className = 'duck-table'; tools.className = 'duck-table-tools'; tools.contentEditable = 'false';
  tools.setAttribute('role', 'group'); tools.setAttribute('aria-label', 'Table size');
  table.append(contentDOM); dom.append(table, tools);
  for (const axis of ['row', 'column']) {
    const button = document.createElement('button'); button.type = 'button';
    button.textContent = axis === 'row' ? '+ Row' : '+ Column';
    button.setAttribute('aria-label', `Add ${axis}`); button.title = axis === 'row' ? 'Add a row at the bottom' : 'Add a column on the right';
    button.addEventListener('pointerdown', event => event.preventDefault());
    button.addEventListener('click', () => {
      if (!view.editable) return;
      const tr = appendTable(view.state, ctx, getPos(), axis);
      if (tr) { view.dispatch(tr); view.focus(); }
    }); tools.append(button);
  }
  return { dom, contentDOM, update(next) { return next.type === node.type; }, stopEvent: event => tools.contains(event.target), ignoreMutation: mutation => tools.contains(mutation.target) };
});
