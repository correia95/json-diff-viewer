export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type PathSegment = string | number;

export interface DiffEntry {
  path: PathSegment[];
  kind: 'added' | 'removed' | 'changed';
  oldValue?: JsonValue;
  newValue?: JsonValue;
}

function isPlainObject(v: JsonValue): v is { [key: string]: JsonValue } {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

export function deepEqual(a: JsonValue, b: JsonValue): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
  }
  return false;
}

export function diffValues(a: JsonValue, b: JsonValue, path: PathSegment[] = []): DiffEntry[] {
  if (deepEqual(a, b)) return [];

  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    const entries: DiffEntry[] = [];
    for (const key of keys) {
      const inA = Object.prototype.hasOwnProperty.call(a, key);
      const inB = Object.prototype.hasOwnProperty.call(b, key);
      if (inA && !inB) entries.push({ path: [...path, key], kind: 'removed', oldValue: a[key] });
      else if (!inA && inB) entries.push({ path: [...path, key], kind: 'added', newValue: b[key] });
      else entries.push(...diffValues(a[key], b[key], [...path, key]));
    }
    return entries;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    const entries: DiffEntry[] = [];
    const maxLen = Math.max(a.length, b.length);
    for (let i = 0; i < maxLen; i++) {
      if (i >= a.length) entries.push({ path: [...path, i], kind: 'added', newValue: b[i] });
      else if (i >= b.length) entries.push({ path: [...path, i], kind: 'removed', oldValue: a[i] });
      else entries.push(...diffValues(a[i], b[i], [...path, i]));
    }
    return entries;
  }

  // Primitives that differ, or a type mismatch (object vs array vs primitive).
  return [{ path, kind: 'changed', oldValue: a, newValue: b }];
}

export function formatPath(path: PathSegment[]): string {
  if (path.length === 0) return '(root)';
  let out = '';
  for (const seg of path) {
    if (typeof seg === 'number') out += `[${seg}]`;
    else out += out === '' ? seg : `.${seg}`;
  }
  return out;
}

export interface ParseResult {
  value: JsonValue | null;
  error: string | null;
}

export function parseJson(text: string): ParseResult {
  if (text.trim() === '') return { value: null, error: 'Empty input' };
  try {
    return { value: JSON.parse(text), error: null };
  } catch (e) {
    return { value: null, error: e instanceof Error ? e.message : 'Invalid JSON' };
  }
}

export function summarize(entries: DiffEntry[]): { added: number; removed: number; changed: number } {
  return {
    added: entries.filter((e) => e.kind === 'added').length,
    removed: entries.filter((e) => e.kind === 'removed').length,
    changed: entries.filter((e) => e.kind === 'changed').length,
  };
}

// Unicode-safe base64url: a single encoding pass into a URL-safe alphabet,
// so URLSearchParams.set never has anything left to re-encode.
export function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(encoded: string): string {
  let s = encoded.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const binary = atob(s);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export interface State {
  left: string;
  right: string;
}

export function encodeState(state: State): URLSearchParams {
  const params = new URLSearchParams();
  params.set('d', toBase64Url(JSON.stringify(state)));
  return params;
}

export function decodeState(params: URLSearchParams, fallback: State): State {
  const raw = params.get('d');
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(fromBase64Url(raw));
    if (!parsed || typeof parsed.left !== 'string' || typeof parsed.right !== 'string') return fallback;
    return { left: parsed.left, right: parsed.right };
  } catch {
    return fallback;
  }
}
