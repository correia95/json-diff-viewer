# JSON Diff Viewer

Compare two JSON documents by structure and value, not by line — reordered
keys and reformatted whitespace never show up as false differences.

- Recursive structural diff: added/removed keys, changed primitives, array
  differences by index, and type-mismatch changes (object vs array vs
  primitive) all reported with their exact path
- Key order never counts as a difference
- Shareable link (`?d=`) encodes both documents as a single unicode-safe
  base64url blob; nothing is uploaded, works offline

## Develop

```
npm install
npm run dev
npm run build      # tsc --noEmit && vite build
node --experimental-strip-types --test src/jsondiff.test.mjs
```

The engine (`diffValues`, `deepEqual`, `formatPath`) is in
`src/jsondiff.ts`. 16 Node tests in `src/jsondiff.test.mjs`.

## Deploy

Static assets on Cloudflare Workers (`wrangler.jsonc`). Live at
<https://json-diff-viewer.correia95.workers.dev/>.
