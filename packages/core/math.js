import { $node, $remark, $view, $inputRule } from '@milkdown/kit/utils';
import { InputRule } from '@milkdown/kit/prose/inputrules';
import { TextSelection } from '@milkdown/kit/prose/state';
import remarkMath from 'remark-math';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// Values remain LaTeX in the document; rendered DOM is only a node view.
export function mathPlugins(edit) {
  const plugins = [...$remark('duckMath', () => remarkMath)];
  for (const display of [false, true]) {
    const id = display ? 'math_block' : 'math_inline';
    const schema = $node(id, () => ({
      group: display ? 'block' : 'inline', inline: !display, atom: true,
      attrs: { value: { default: '', validate: 'string' } },
      toDOM: node => [display ? 'div' : 'span', { 'data-math': id, 'data-value': node.attrs.value }, node.attrs.value],
      parseDOM: [{ tag: `[data-math=${id}]`, getAttrs: dom => ({ value: dom.dataset.value || '' }) }],
      parseMarkdown: { match: node => node.type === (display ? 'math' : 'inlineMath'), runner: (state, node, type) => state.addNode(type, { value: node.value }) },
      toMarkdown: { match: node => node.type.name === id, runner: (state, node) => state.addNode(display ? 'math' : 'inlineMath', undefined, node.attrs.value) },
    }));
    plugins.push(schema, $view(schema, () => (node, view, getPos) => {
      const dom = document.createElement(display ? 'div' : 'span');
      dom.className = display ? 'duck-math duck-math-block' : 'duck-math';
      dom.contentEditable = 'false'; dom.tabIndex = 0; dom.setAttribute('role', 'button');
      const render = current => {
        node = current; dom.setAttribute('aria-label', `Edit equation: ${node.attrs.value || 'empty'}`);
        if (node.attrs.value) katex.render(node.attrs.value, dom, { displayMode: display, throwOnError: false, trust: false, maxSize: 20 });
        else dom.textContent = 'Add equation…';
      };
      const open = () => { if (view.editable) edit({ node, view, pos: getPos(), display }); };
      dom.addEventListener('click', open);
      dom.addEventListener('keydown', event => {
        if (['Enter', ' '].includes(event.key)) { event.preventDefault(); open(); }
        else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
          event.preventDefault(); const backwards = ['ArrowLeft', 'ArrowUp'].includes(event.key);
          const pos = getPos() + (backwards ? 0 : node.nodeSize);
          view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(pos), backwards ? -1 : 1))); view.focus();
        }
      });
      render(node);
      return { dom, update(next) { if (next.type !== node.type) return false; render(next); return true; }, stopEvent: () => true, ignoreMutation: () => true };
    }));
    plugins.push($inputRule(ctx => new InputRule(display ? /^\$\$([^$]+)\$\$$/ : /(?<![\\$])\$(?!\$)([^$\n]+)\$$/, (state, match, start, end) => {
      const node = schema.type(ctx).create({ value: match[1] });
      if (display) {
        const position = state.doc.resolve(start);
        if (position.parent.type.name !== 'paragraph') return null;
        return state.tr.replaceWith(position.before(), position.after(), node);
      }
      return state.tr.replaceWith(start, end, node);
    })));
  }
  return plugins;
}
