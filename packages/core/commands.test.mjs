import test from 'node:test';
import assert from 'node:assert/strict';
import { commands, commandQuery, sourceCommandQuery, pageHref, externalLink, linkMarkdown, matchingPages, matchingCommands } from './commands.js';
test('command matching is bounded and does not capture URL paths or escaped slashes', () => {
  assert.deepEqual(commandQuery('See /link page'), { query: 'link page', length: 10 });
  for (const text of ['https://example.org/', 'foo/bar', '\\/', '/'+ 'a'.repeat(40)]) assert.equal(commandQuery(text),null);
  assert.equal(matchingCommands('link url')[0].id, 'url');
  assert.deepEqual(commands.map(command=>command.id),['page','url','image','code','math','table','bullet','checklist']);
});
test('source commands ignore code fences and inline code', () => {
  for (const text of ['```js\n/image','~~~~\n/code block','`/image']) assert.equal(sourceCommandQuery(text,text.length),null);
  const text='```js\ncode\n```\n/link'; assert.equal(sourceCommandQuery(text,text.length).query,'link');
});
test('page links retain full unambiguous paths and safely encode titles and URLs', () => {
  assert.equal(pageHref('notes/posts/Olá #1.md','notes'),'posts/Ol%C3%A1%20%231.md');
  assert.equal(linkMarkdown('My [post]','posts/a.md'),'[My \\[post\\]](<posts/a.md>)');
  assert.throws(()=>pageHref('elsewhere/a.md','notes'));
  assert.throws(()=>pageHref('notes/../private.md','notes'));
  assert.equal(linkMarkdown('A *title* with $math$','posts/a.md'),'[A \\*title\\* with \\$math\\$](<posts/a.md>)');
  for(const url of ['javascript:alert(1)','data:text/html,test','https://example.org/\nsecret']) assert.throws(()=>externalLink(url));
  assert.equal(externalLink('https://example.org/'),'https://example.org/');
  assert.equal(matchingPages([{title:'Two words',path:'posts/a.md'},{title:'Other',path:'notes/b.md'}],'two a.md').length,1);
});
