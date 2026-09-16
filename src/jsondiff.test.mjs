import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  deepEqual, diffValues, formatPath, parseJson, summarize,
  toBase64Url, fromBase64Url, encodeState, decodeState,
} from './jsondiff.ts';

test('deepEqual treats objects with the same keys in a different order as equal', () => {
  assert.equal(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 }), true);
});

test('deepEqual detects differing array lengths and elements', () => {
  assert.equal(deepEqual([1, 2, 3], [1, 2]), false);
  assert.equal(deepEqual([1, 2, 3], [1, 2, 4]), false);
  assert.equal(deepEqual([1, [2, 3]], [1, [2, 3]]), true);
});

test('deepEqual distinguishes an object from an array even with matching-looking content', () => {
  assert.equal(deepEqual({ 0: 'a' }, ['a']), false);
});

test('diffValues on identical values returns no differences', () => {
  assert.deepEqual(diffValues({ a: 1, b: [1, 2] }, { a: 1, b: [1, 2] }), []);
});

test('diffValues reports an added key', () => {
  const entries = diffValues({ a: 1 }, { a: 1, b: 2 });
  assert.deepEqual(entries, [{ path: ['b'], kind: 'added', newValue: 2 }]);
});

test('diffValues reports a removed key', () => {
  const entries = diffValues({ a: 1, b: 2 }, { a: 1 });
  assert.deepEqual(entries, [{ path: ['b'], kind: 'removed', oldValue: 2 }]);
});

test('diffValues reports a changed primitive with the correct path', () => {
  const entries = diffValues({ user: { name: 'Alice' } }, { user: { name: 'Bob' } });
  assert.deepEqual(entries, [{ path: ['user', 'name'], kind: 'changed', oldValue: 'Alice', newValue: 'Bob' }]);
});

test('diffValues reports array element changes by index, and added/removed for length differences', () => {
  const entries = diffValues([1, 2, 3], [1, 9, 3, 4]);
  assert.deepEqual(entries, [
    { path: [1], kind: 'changed', oldValue: 2, newValue: 9 },
    { path: [3], kind: 'added', newValue: 4 },
  ]);
});

test('diffValues reports a type mismatch (object vs array vs primitive) as a single changed entry', () => {
  const entries = diffValues({ a: { x: 1 } }, { a: [1, 2] });
  assert.deepEqual(entries, [{ path: ['a'], kind: 'changed', oldValue: { x: 1 }, newValue: [1, 2] }]);

  const entries2 = diffValues({ a: 5 }, { a: null });
  assert.deepEqual(entries2, [{ path: ['a'], kind: 'changed', oldValue: 5, newValue: null }]);
});

test('diffValues on deeply nested structures finds every difference with correct paths', () => {
  const before = { config: { retries: 3, hosts: ['a', 'b'], nested: { flag: true } } };
  const after = { config: { retries: 5, hosts: ['a', 'c'], nested: { flag: true }, extra: 'new' } };
  const entries = diffValues(before, after);
  const paths = entries.map((e) => formatPath(e.path)).sort();
  assert.deepEqual(paths, ['config.extra', 'config.hosts[1]', 'config.retries']);
});

test('formatPath renders dotted keys, bracketed indices, and the root case', () => {
  assert.equal(formatPath([]), '(root)');
  assert.equal(formatPath(['a', 'b']), 'a.b');
  assert.equal(formatPath(['a', 2, 'b']), 'a[2].b');
  assert.equal(formatPath([0]), '[0]');
});

test('parseJson returns the parsed value for valid JSON and an error message for invalid JSON', () => {
  const ok = parseJson('{"a": 1}');
  assert.equal(ok.error, null);
  assert.deepEqual(ok.value, { a: 1 });

  const bad = parseJson('{not valid json}');
  assert.notEqual(bad.error, null);
  assert.equal(bad.value, null);

  const empty = parseJson('   ');
  assert.notEqual(empty.error, null);
});

test('summarize counts each kind of difference', () => {
  const entries = diffValues(
    { a: 1, b: 2, c: 3 },
    { a: 1, b: 99, d: 4 },
  );
  assert.deepEqual(summarize(entries), { added: 1, removed: 1, changed: 1 });
});

test('toBase64Url / fromBase64Url round-trip unicode text and are URL-safe', () => {
  const samples = ['{"a":1}', 'ünïcödé "value" with emoji 🎉', ''];
  for (const s of samples) {
    const encoded = toBase64Url(s);
    assert.equal(/[+/=]/.test(encoded), false);
    assert.equal(fromBase64Url(encoded), s);
  }
});

test('encodeState / decodeState round-trip two JSON documents exactly', () => {
  const state = {
    left: '{"name": "Ünïcödé", "tags": ["a", "b"]}',
    right: '{"name": "Ünïcödé", "tags": ["a", "b", "c"]}',
  };
  const decoded = decodeState(encodeState(state), { left: '', right: '' });
  assert.deepEqual(decoded, state);
});

test('decodeState falls back safely on missing or corrupted data', () => {
  const fallback = { left: '{}', right: '{}' };
  assert.deepEqual(decodeState(new URLSearchParams(), fallback), fallback);
  assert.deepEqual(decodeState(new URLSearchParams('d=not-valid-base64!!!'), fallback), fallback);
});
