import { $view } from '@milkdown/kit/utils';
import { codeBlockSchema } from '@milkdown/kit/preset/commonmark';
import { closeHistory } from '@milkdown/kit/prose/history';

const languages = [
  ['', 'Plain text'], ['javascript', 'JavaScript'], ['typescript', 'TypeScript'],
  ['python', 'Python'], ['java', 'Java'], ['bash', 'Shell'], ['json', 'JSON'],
  ['yaml', 'YAML'], ['html', 'HTML'], ['css', 'CSS'], ['sql', 'SQL'],
  ['go', 'Go'], ['rust', 'Rust'], ['c', 'C'], ['cpp', 'C++'],
  ['csharp', 'C#'], ['markdown', 'Markdown'],
];

export function codeLanguage(state, pos, language) {
  const node = state.doc.nodeAt(pos);
  if (node?.type.name !== 'code_block' || node.attrs.language === language) return null;
  return closeHistory(state.tr).setNodeMarkup(pos, undefined, { ...node.attrs, language });
}

// A native picker; the code stays a normal fenced Markdown block.
export const codeTools = $view(codeBlockSchema.node, () => (node, view, getPos) => {
  const dom = document.createElement('div'), label = document.createElement('label'), select = document.createElement('select'), pre = document.createElement('pre'), contentDOM = document.createElement('code');
  dom.className = 'duck-code'; label.className = 'duck-code-language'; label.contentEditable = 'false';
  label.append('Language ', select); select.setAttribute('aria-label', 'Code language');
  for (const [value, name] of languages) select.add(new Option(name, value));
  pre.append(contentDOM); dom.append(label, pre);
  const render = current => {
    node = current; const language = node.attrs.language;
    select.querySelector('[data-custom]')?.remove();
    // Preserve imported aliases and other languages without rewriting them on load.
    if (!languages.some(([value]) => value === language)) {
      const option = new Option(language, language); option.dataset.custom = ''; select.add(option);
    }
    select.value = language; select.disabled = !view.editable;
    pre.dataset.language = language; contentDOM.className = language ? `language-${language}` : '';
  };
  select.addEventListener('change', () => {
    if (!view.editable) { render(node); return; }
    const tr = codeLanguage(view.state, getPos(), select.value);
    if (tr) view.dispatch(tr);
    view.focus();
  }); render(node);
  return { dom, contentDOM, update(next) { if (next.type !== node.type) return false; render(next); return true; }, stopEvent: event => label.contains(event.target), ignoreMutation: mutation => label.contains(mutation.target) || mutation.type === 'attributes' && [pre, contentDOM].includes(mutation.target) };
});
