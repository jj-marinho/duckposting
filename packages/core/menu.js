import { SlashProvider } from '@milkdown/kit/plugin/slash';
import { $prose } from '@milkdown/kit/utils';
import { Plugin, TextSelection } from '@milkdown/kit/prose/state';
import { commandQuery, matchingCommands } from './commands.js';

export function commandMenu(root, { capture, run, blocked, error }) {
  const menu = document.createElement('div');
  menu.id = 'duck-commands'; menu.className = 'duck-command-menu'; menu.hidden = true;
  menu.setAttribute('role', 'listbox'); menu.setAttribute('aria-label', 'Insert');
  root.append(menu);
  const controller = new AbortController();
  let items = [], index = 0, range, dismissed, provider, richView, anchor, explicit = false;
  const close = () => {
    menu.hidden = true; explicit = false;
    for (const node of root.querySelectorAll('[aria-controls=duck-commands]')) {
      node.removeAttribute('aria-controls'); node.removeAttribute('aria-activedescendant');
    }
    root.querySelector('#insert')?.setAttribute('aria-expanded', 'false');
  };
  function announce() {
    const input = root.querySelector(range?.source ? '#post' : '#body .ProseMirror');
    if (input && !explicit) {
      input.setAttribute('aria-controls', menu.id);
      if (items[index]) input.setAttribute('aria-activedescendant', `duck-command-${items[index].id}`);
      else input.removeAttribute('aria-activedescendant');
    }
    root.querySelector('#insert')?.setAttribute('aria-expanded', String(explicit));
  }
  const pick = () => {
    const item = items[index], target = range;
    if (!item || blocked()) return;
    dismissed = range?.key; close();
    try { run(item, target); } catch (reason) { error(reason.message); }
  };
  function render(query, target) {
    if (blocked()) { close(); return; }
    range = target; items = matchingCommands(query); index = Math.min(index, Math.max(0, items.length - 1));
    menu.replaceChildren();
    for (const [i, item] of items.entries()) {
      const button = document.createElement('button'); button.type = 'button';
      button.id = `duck-command-${item.id}`; button.textContent = item.label;
      button.setAttribute('role', 'option'); button.setAttribute('aria-selected', String(i === index));
      button.dataset.index = i;
      menu.append(button);
    }
    if (!items.length) { const empty = document.createElement('p'); empty.textContent = 'No matching command'; menu.append(empty); }
    menu.hidden = false;
    announce();
  }
  menu.addEventListener('pointerdown', event => event.preventDefault(), { signal: controller.signal });
  menu.addEventListener('click', event => {
    const button = event.target.closest('button[data-index]');
    if (button) { index = Number(button.dataset.index); pick(); }
  }, { signal: controller.signal });
  function key(event) {
    if (menu.hidden || event.isComposing) return false;
    if (event.key === 'Escape') { dismissed = range?.key; close(); }
    else if (['ArrowUp', 'ArrowDown'].includes(event.key)) {
      index = (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % (items.length || 1);
      for (const [i, button] of [...menu.querySelectorAll('button')].entries()) button.setAttribute('aria-selected', String(i === index));
      menu.children[index]?.scrollIntoView({ block: 'nearest' });
      announce();
    } else if (event.key === 'Enter') pick();
    else return false;
    event.preventDefault(); return true;
  }
  root.addEventListener('keydown', event => { if (explicit && !event.defaultPrevented) key(event); }, { signal: controller.signal });
  root.ownerDocument.addEventListener('pointerdown', event => { if (!menu.contains(event.target)) { dismissed = range?.key; close(); } }, { signal: controller.signal });
  root.ownerDocument.addEventListener('focusin', event => {
    if (!explicit && !menu.hidden && !menu.contains(event.target) && !event.target.closest('#post, #body')) { dismissed = range?.key; close(); }
  }, { signal: controller.signal });
  function reposition() {
    if (menu.hidden) return;
    if (explicit || range?.source) position(anchor); else provider?.update(richView);
  }
  root.ownerDocument.defaultView.addEventListener('resize', reposition, { signal: controller.signal });
  root.ownerDocument.addEventListener('scroll', event => { if (event.target !== menu) reposition(); }, { capture: true, signal: controller.signal });
  function refresh(view) {
    if (explicit) return true;
    if (blocked() || view.composing || !view.hasFocus() || !view.state.selection.empty || view.state.selection.$from.parent.type.name !== 'paragraph' || view.state.selection.$from.marks().some(mark => mark.type.spec.code)) { close(); return false; }
    const { $from } = view.state.selection;
    const text = $from.parent.textBetween(0, $from.parentOffset, '', '\ufffc');
    const match = commandQuery(text);
    if (!match) { dismissed = undefined; close(); return false; }
    const target = capture(TextSelection.create(view.state.doc, $from.pos - match.length, $from.pos).getBookmark());
    target.key = `${$from.pos}:${text}`;
    if (dismissed === target.key) { close(); return false; }
    render(match.query, target); return true;
  }
  const plugin = $prose(() => new Plugin({
    props: { handleKeyDown: (view, event) => {
      // Positioning is debounced; Enter must use the latest text and selection.
      if (['Enter', 'Escape', 'ArrowUp', 'ArrowDown'].includes(event.key)) refresh(view);
      return key(event);
    } },
    view(view) {
      richView = view;
      provider = new SlashProvider({ content: menu, root, debounce: 20,
        floatingUIOptions: { strategy: 'fixed' }, middleware: [{ name: 'viewport', fn: ({ x, y, rects }) => ({
          x: Math.max(8, Math.min(x, window.innerWidth - rects.floating.width - 8)),
          y: Math.max(8, Math.min(y, window.innerHeight - rects.floating.height - 8)),
        }) }], shouldShow: () => refresh(view) });
      return { update: provider.update, destroy() { provider.destroy(); close(); } };
    },
  }));
  return { plugin, close, key, source(query, target, trigger) {
    if (target.key === dismissed) return;
    anchor = trigger; render(query, target); position(anchor);
  }, open(target, trigger) { anchor = trigger; explicit = true; dismissed = undefined; index = 0; render('', target); position(anchor); },
  destroy() { provider?.destroy(); controller.abort(); menu.remove(); } };
  function position(anchor) {
    const box = anchor.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(box.left, window.innerWidth - menu.offsetWidth - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(box.bottom + 6, window.innerHeight - menu.offsetHeight - 8))}px`;
  }
}
