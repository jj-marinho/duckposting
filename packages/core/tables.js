import { $view } from '@milkdown/kit/utils';
import { tableSchema, addRowWithAlignment } from '@milkdown/kit/preset/gfm';
import { TableMap, addColumnAfter, deleteColumn, deleteRow } from '@milkdown/kit/prose/tables';
import { TextSelection } from '@milkdown/kit/prose/state';
import { closeHistory } from '@milkdown/kit/prose/history';

// Milkdown requires a header plus at least one body row, and one column.
const atMinimum = (map, axis) => axis === 'row' ? map.height <= 2 : map.width <= 1;

export function resizeTable(state, ctx, pos, axis, remove = false) {
  const table = state.doc.nodeAt(pos);
  if (table?.type.name !== 'table') return null;
  const map = TableMap.get(table);
  if (remove && atMinimum(map, axis)) return null;
  let tr;
  if (axis === 'row' && !remove) {
    tr = addRowWithAlignment(ctx, closeHistory(state.tr), { map, tableStart: pos + 1, table }, map.height);
  } else {
    const edge = pos + 1 + map.map[axis === 'row' ? (map.height - 1) * map.width : map.width - 1] + 2;
    const selected = state.apply(state.tr.setSelection(TextSelection.create(state.doc, edge)));
    const command = remove ? (axis === 'row' ? deleteRow : deleteColumn) : addColumnAfter;
    command(selected, result => { tr = closeHistory(result); });
  }
  if (!tr) return null;
  const next = TableMap.get(tr.doc.nodeAt(pos));
  const cell = next.map[axis === 'row' ? (next.height - 1) * next.width : next.width - 1];
  return tr.setSelection(TextSelection.create(tr.doc, pos + 1 + cell + 2)).scrollIntoView();
}

// Controls belong to their table, including when another table holds the cursor.
export const tableTools = $view(tableSchema.node, ctx => (node, view, getPos) => {
  const dom = document.createElement('div'), table = document.createElement('table'), contentDOM = document.createElement('tbody'), controls = [];
  dom.className = 'duck-table'; table.append(contentDOM); dom.append(table);
  for (const axis of ['column', 'row']) {
    const tools = document.createElement('div');
    tools.className = `duck-table-tools duck-table-${axis}s`; tools.contentEditable = 'false';
    tools.setAttribute('role', 'group'); tools.setAttribute('aria-label', `Table ${axis}s`);
    for (const remove of [false, true]) {
      const button = document.createElement('button'); button.type = 'button';
      button.textContent = `${remove ? '−' : '+'} ${axis === 'row' ? 'Row' : 'Column'}`;
      button.setAttribute('aria-label', `${remove ? 'Remove' : 'Add'} ${axis}`);
      button.title = remove ? `Remove the last ${axis}` : `Add a ${axis} ${axis === 'row' ? 'at the bottom' : 'on the right'}`;
      button.addEventListener('pointerdown', event => event.preventDefault());
      button.addEventListener('click', () => {
        if (!view.editable) return;
        const tr = resizeTable(view.state, ctx, getPos(), axis, remove);
        if (tr) { view.dispatch(tr); view.focus(); }
      }); tools.append(button); controls.push({ button, axis, remove });
    }
    dom.append(tools);
  }
  const render = current => {
    node = current; const map = TableMap.get(node);
    for (const { button, axis, remove } of controls) {
      const minimum = remove && atMinimum(map, axis);
      button.dataset.minimum = String(minimum); button.disabled = minimum || !view.editable;
    }
  }; render(node);
  const isControl = target => controls.some(({ button }) => button.parentElement.contains(target));
  return { dom, contentDOM, update(next) { if (next.type !== node.type) return false; render(next); return true; }, stopEvent: event => isControl(event.target), ignoreMutation: mutation => isControl(mutation.target) };
});
