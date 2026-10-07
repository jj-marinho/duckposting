import test from 'node:test';
import assert from 'node:assert/strict';
import { Schema } from '@milkdown/kit/prose/model';
import { EditorState, TextSelection } from '@milkdown/kit/prose/state';
import { history, undo } from '@milkdown/kit/prose/history';
import { Ctx, Container, Clock } from '@milkdown/ctx';
import { nodesCtx, schemaCtx } from '@milkdown/kit/core';
import { docSchema, textSchema, paragraphSchema, codeBlockSchema, bulletListSchema, linkSchema } from '@milkdown/kit/preset/commonmark';
import { extendListItemSchemaForTask, tableSchema, tableHeaderRowSchema, tableRowSchema, tableCellSchema, tableHeaderSchema } from '@milkdown/kit/preset/gfm';
import { ParserState, SerializerState } from '@milkdown/kit/transformer';
import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import { insertFragment, sourceFragment } from './insert.js';
import { commands, linkMarkdown } from './commands.js';
import { appendTable } from './tables.js';
import { TableMap } from '@milkdown/kit/prose/tables';

const ctx = new Ctx(new Container(), new Clock());
ctx.inject(nodesCtx, []);
await docSchema(ctx)(); await textSchema(ctx)();
for (const node of [paragraphSchema, codeBlockSchema, bulletListSchema, extendListItemSchemaForTask, tableSchema, tableHeaderRowSchema, tableRowSchema, tableCellSchema, tableHeaderSchema]) {
  node.ctx(ctx); await node.node(ctx)();
}
linkSchema.ctx(ctx);
const schema = new Schema({ nodes: Object.fromEntries(ctx.get(nodesCtx)), marks: { link: ctx.get(linkSchema.key)(ctx) } });
ctx.inject(schemaCtx, schema);
const markdown = remark().use(remarkGfm);
const parse = ParserState.create(schema, markdown), serialize = SerializerState.create(schema, markdown);

test('native GFM parsing retains checked tasks and rectangular tables on save', () => {
  const tasks = parse('- [ ] Unfinished\n- [x] Finished');
  assert.equal(tasks.firstChild.child(0).attrs.checked, false);
  assert.equal(tasks.firstChild.child(1).attrs.checked, true);
  assert.match(serialize(tasks), /\[x\] Finished/);
  const table = parse(commands.find(command => command.id === 'table').markdown);
  assert.equal(table.firstChild.type.name, 'table');
  assert.equal(table.firstChild.childCount, 3);
  assert.equal(parse(serialize(table)).firstChild.childCount, 3);
});
test('fragments replace only the command, put the cursor inside the block and undo as one action', () => {
  const original = parse('Before /code after');
  let state = EditorState.create({ schema, doc: original, plugins: [history()] });
  const selection = TextSelection.create(original, 8, 13);
  state = state.apply(insertFragment(state, selection, parse('```\n\n```'), true, false));
  assert.equal(state.selection.$from.parent.type.name, 'code_block');
  assert.match(serialize(state.doc), /Before/); assert.match(serialize(state.doc), /after/);
  assert.doesNotMatch(serialize(state.doc), /\/code/);
  assert(undo(state, tr => state = state.apply(tr)));
  assert(state.doc.eq(original));
});
test('inline links do not split a paragraph; checklist placeholder stays inside its item', () => {
  const doc = parse('Before /link after'), state = EditorState.create({ schema, doc });
  const linked = insertFragment(state, TextSelection.create(doc, 8, 13), parse(linkMarkdown('Page', 'posts/page.md')), false, false);
  assert.equal(linked.doc.childCount, 1);
  assert.equal(linked.doc.textContent, 'Before Page after');
  assert.match(serialize(linked.doc), /\[Page\]\(posts\/page.md\)/);
  const task = insertFragment(state, TextSelection.create(doc, 8, 13), parse('- [ ] Item'), true, true);
  assert.equal(task.selection.$from.parent.textContent, 'Item');
  assert.equal(task.doc.textBetween(task.selection.from, task.selection.to), 'Item');
});
test('source insertion keeps code cursor inside its fence and selects checklist text', () => {
  const code = sourceFragment('```\n\n```', true, false);
  assert.equal(code.text.slice(0, code.from), '\n\n```\n');
  const task = sourceFragment('- [ ] Item', true, 'Item');
  assert.equal(task.text.slice(task.from, task.to), 'Item');
});
test('table controls append to their own table, retain alignment/content, focus new cells and undo once', () => {
  const tableText = '| First | Second |\n| :--- | ---: |\n| A | B |';
  const original = parse(`Before\n\n${tableText}\n\nBetween\n\n${tableText}\n\nAfter`);
  let pos;
  original.forEach((node, offset) => { if (node.type.name === 'table') pos = offset; });
  for (const axis of ['row', 'column']) {
    let state = EditorState.create({ schema, doc: original, plugins: [history()] });
    state = state.apply(appendTable(state, ctx, pos, axis));
    const table = state.doc.nodeAt(pos), map = TableMap.get(table);
    assert.equal(map.height, axis === 'row' ? 3 : 2);
    assert.equal(map.width, axis === 'column' ? 3 : 2);
    assert(state.doc.child(1).eq(original.child(1)), 'The other table stays unchanged');
    assert.equal(table.child(0).child(1).attrs.alignment, 'right');
    if (axis === 'row') assert.equal(table.lastChild.child(1).attrs.alignment, 'right');
    assert.equal(table.child(1).child(0).textContent, 'A');
    assert.equal(state.selection.$from.parent.textContent, '');
    assert.doesNotThrow(() => parse(serialize(state.doc)).check());
    assert(undo(state, tr => state = state.apply(tr)));
    assert(state.doc.eq(original));
  }
});
