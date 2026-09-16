import { useMemo, useState } from 'react';
import {
  parseJson, diffValues, formatPath, summarize, DiffEntry, JsonValue,
  encodeState, decodeState,
} from './jsondiff';

const SAMPLE_LEFT = `{
  "name": "Widget",
  "version": "1.0.0",
  "price": 19.99,
  "tags": ["new", "sale"],
  "inStock": true
}`;

const SAMPLE_RIGHT = `{
  "name": "Widget",
  "version": "1.1.0",
  "price": 24.99,
  "tags": ["sale", "featured"],
  "inStock": true,
  "discontinued": false
}`;

function readInitial(): { left: string; right: string } {
  const params = new URLSearchParams(window.location.search);
  const decoded = decodeState(params, { left: SAMPLE_LEFT, right: SAMPLE_RIGHT });
  return decoded;
}

function formatValue(v: JsonValue | undefined): string {
  if (v === undefined) return '';
  if (typeof v === 'string') return JSON.stringify(v);
  if (v === null) return 'null';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export default function App() {
  const initial = useMemo(readInitial, []);
  const [left, setLeft] = useState(initial.left);
  const [right, setRight] = useState(initial.right);
  const [copied, setCopied] = useState(false);

  const leftParsed = useMemo(() => parseJson(left), [left]);
  const rightParsed = useMemo(() => parseJson(right), [right]);

  const entries: DiffEntry[] = useMemo(() => {
    if (leftParsed.error || rightParsed.error) return [];
    return diffValues(leftParsed.value as JsonValue, rightParsed.value as JsonValue);
  }, [leftParsed, rightParsed]);

  const counts = useMemo(() => summarize(entries), [entries]);
  const bothValid = !leftParsed.error && !rightParsed.error;

  function swap() {
    setLeft(right);
    setRight(left);
  }

  async function shareLink() {
    const params = encodeState({ left, right });
    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', `?${params.toString()}`);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <main className="page">
      <h1>JSON Diff Viewer</h1>
      <p className="lede">
        Compare two JSON documents by structure and value, not by line — reordered keys and
        reformatted whitespace never show up as false differences.
      </p>

      <div className="editors">
        <div className="editor-col">
          <div className="editor-head"><span>Before</span></div>
          <textarea value={left} onChange={(e) => setLeft(e.target.value)} spellCheck={false} />
          {leftParsed.error && <p className="parse-error">{leftParsed.error}</p>}
        </div>
        <div className="editor-col">
          <div className="editor-head"><span>After</span></div>
          <textarea value={right} onChange={(e) => setRight(e.target.value)} spellCheck={false} />
          {rightParsed.error && <p className="parse-error">{rightParsed.error}</p>}
        </div>
      </div>

      <div className="actions">
        <button onClick={swap}>Swap</button>
        <button onClick={shareLink}>{copied ? 'Copied!' : 'Copy share link'}</button>
      </div>

      {bothValid && (
        <section className="result">
          <div className="summary-row">
            <span className="badge added">+{counts.added} added</span>
            <span className="badge removed">-{counts.removed} removed</span>
            <span className="badge changed">~{counts.changed} changed</span>
          </div>

          {entries.length === 0 ? (
            <p className="no-diff">No differences — these documents are structurally identical.</p>
          ) : (
            <ul className="diff-list">
              {entries.map((e, i) => (
                <li key={i} className={`diff-entry ${e.kind}`}>
                  <span className="diff-path">{formatPath(e.path)}</span>
                  {e.kind === 'added' && <span className="diff-value">+ {formatValue(e.newValue)}</span>}
                  {e.kind === 'removed' && <span className="diff-value">- {formatValue(e.oldValue)}</span>}
                  {e.kind === 'changed' && (
                    <span className="diff-value">
                      <span className="old">{formatValue(e.oldValue)}</span>
                      {' → '}
                      <span className="new">{formatValue(e.newValue)}</span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="explainer">
        <h2>How this works</h2>
        <p>
          Both documents are parsed and compared value-by-value, not line-by-line — an object with
          reordered keys or a re-indented array won't show up as a difference, only actual content
          changes will. Everything runs in your browser; nothing is uploaded.
        </p>
        <h2>Frequently asked questions</h2>
        <h3>Does key order matter?</h3>
        <p>No — two objects with the same keys and values are treated as identical regardless of order.</p>
        <h3>How are array differences shown?</h3>
        <p>
          By index: if element 2 changed, you'll see a change at that index. Inserting an element in
          the middle of an array will show as changes to every following index plus one addition at
          the end, since this compares by position rather than trying to detect a reordering.
        </p>
        <h3>What happens if a value changes type entirely?</h3>
        <p>
          A value changing from, say, an object to an array or a number to a string is shown as a
          single "changed" entry with the old and new value in full, rather than trying to diff
          incompatible shapes against each other.
        </p>
      </section>
    </main>
  );
}
