import test from 'node:test';
import assert from 'node:assert/strict';
import { transferImages } from './media.js';
test('paste and drop send image files to the same upload path at the captured selection', () => {
  for (const field of ['clipboardData', 'dataTransfer']) {
    const image = { name: 'photo.png', type: 'image/png' }, untyped = { name: 'phone.JPG', type: '' };
    let prevented = false, saved;
    const selection = { from: 5, to: 10 };
    assert(transferImages({ [field]: { files: [image, { name: 'text.txt', type: 'text/plain' }, untyped] }, preventDefault() { prevented = true; } }, (files, target) => saved = { files, target }, () => selection));
    assert(prevented); assert.deepEqual(saved, { files: [image, untyped], target: selection });
  }
});
test('ordinary text and internal editor drops retain the native Milkdown handling', () => {
  for (const files of [[], [{ name: 'text.txt', type: 'text/plain' }]]) {
    assert.equal(transferImages({ dataTransfer: { files }, preventDefault() { assert.fail('Native text must not be intercepted'); } }, () => assert.fail('No upload'), () => assert.fail('No capture')), false);
  }
});
