import test from 'node:test';
import assert from 'node:assert/strict';
import { configuration, contentMatcher } from './config.js';
import { contentEntries, publishedIndex } from './catalog.js';
const config = configuration({ repository: 'test/blog', contentRoot: 'notes', exclude: ['private', 'draft-*/**', '**/archive/*.md'] });
test('configuration scopes new posts and rejects unsafe paths before any request', () => {
  assert.equal(config.contentDir, 'notes/posts');
  assert.equal(configuration({ repository: 'test/blog', contentRoot: 'notes', contentDir: 'notes' }).contentDir, 'notes');
  for (const options of [{ repository: undefined }, { repository: 'test/..' }, { contentDir: '.github/workflows' }, { contentRoot: '../notes' }, { contentRoot: 'C:\\notes' }, { exclude: 'private' }, { branch: '' }, { template: null }, { initialPath: '../README.md' }, { initialPath: 'content/images/x.png' }]) {
    assert.throws(() => configuration({ repository: 'test/blog', ...options }));
  }
});
test('content matching honors literal names and real Quartz ignore globs', () => {
  const allowed = contentMatcher(config);
  for (const path of ['notes/private/secret.md', 'notes/sub/private/secret.md', 'notes/draft-old/post.md', 'notes/sub/archive/old.md', 'notes/../README.md', 'README.md', 'notes/image.png']) assert.equal(allowed(path), false, path);
  assert.equal(allowed('notes/posts/你好.md'), true);
  assert.equal(allowed('notes/sub/archive/visible.txt'), false);
});
test('published manifests cannot inject arbitrary repository files or malformed titles', () => {
  for (const data of [null, {}, [{ path: '.github/workflows/action.md', title: 'X' }], [{ path: 'notes/../README.md', title: 'X' }], [{ path: 'notes/private/x.md', title: 'Secret' }], [{ path: 'notes/one.md', title: null }]]) assert.throws(() => publishedIndex(data, config));
  assert.deepEqual(publishedIndex([{ path: 'notes/one.md', title: 'One', sha: 'untrusted', arbitrary: true }], config), [{ path: 'notes/one.md', title: 'One', draft: false }]);
});
test('offline exact-document drafts remain visible even when the deployed index is unavailable', () => {
  const path = 'notes/posts/one.md';
  const store = { known: {}, drafts: { [path]: { id: path, path, text: '---\ntitle: "Offline changes"\n---\n\nBody' }, 'new:1': { id: 'new:1', text: 'New' } } };
  const entries = contentEntries(config, [], null, store);
  assert.equal(entries.length, 1); assert.equal(entries[0].path, path); assert.equal(entries[0].title, 'Offline changes');
});

test('builder manifests retain explicit safe public routes and reject executable URLs', () => {
  const result = publishedIndex([{ path: 'notes/one.md', title: 'One', url: '/project/custom-route/' }], config);
  assert.equal(result[0].url, '/project/custom-route/');
  for (const url of ['javascript:alert(1)', '//other.example/path', '/a\\b', '/a\nb']) assert.throws(() => publishedIndex([{ path: 'notes/one.md', title: 'One', url }], config));
});
test('external upload directories need an explicit safe public mapping', () => {
  const settings = configuration({ repository: 'test/blog', contentRoot: 'src/content/blog', imageDir: 'public/images', imageBase: '/project/images/' });
  assert.equal(settings.imageDir, 'public/images');
  for (const imageBase of ['https://example.org/', '//example.org/', '/a/../b/', '/a/%2e%2e/', '/images', '/a?x/']) assert.throws(() => configuration({ repository: 'test/blog', imageDir: 'public/images', imageBase }));
  assert.throws(() => configuration({ repository: 'test/blog', filenameFormat: 'anything' }));
  assert.throws(() => configuration({ repository: 'test/blog', draftValue: 'false' }));
});

test('local publication status keeps current builder URLs and refreshes them after rebuild', () => {
  const path = 'notes/one.md';
  const store = { known: { [path]: { path, title: 'Edited', draft: false, url: '/stale/' } }, drafts: {} };
  const entries = contentEntries(config, [{ path, title: 'One', url: '/rebuilt/' }], null, store);
  assert.equal(entries[0].url, '/rebuilt/');
  assert.equal(entries[0].title, 'Edited');
});
