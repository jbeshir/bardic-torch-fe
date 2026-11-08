/**
 * A word-level diff of two texts (plan §4.11), with Myers' O(ND) algorithm
 * ("An O(ND) Difference Algorithm and Its Variations", 1986), bounded so
 * it stays cheap in a Worker: above `MAX_TOKENS` words on either side, or
 * once the edit distance passes `MAX_EDITS`, there is no word diff (null)
 * and the page shows the two texts whole. Its cost is at most
 * O((N + M) · MAX_EDITS) steps and memory.
 *
 * A token is a word with the whitespace after it, so the parts put back
 * together are the texts exactly, line breaks and all.
 */

/** A run of the text: kept, added or removed. */
export type WordPart = {
  readonly kind: "same" | "added" | "removed";
  readonly text: string;
};

/** Above this many words on either side, the texts are shown whole. */
const MAX_TOKENS = 1500;

/** Past this many words added or removed, the texts are shown whole. */
const MAX_EDITS = 500;

/** Leading whitespace, then each word with the whitespace after it. */
function tokens(text: string): string[] {
  return text.match(/^\s+|\S+\s*/g) ?? [];
}

type Edit = { readonly kind: WordPart["kind"]; readonly token: string };

/**
 * The shortest edit script from `a` to `b`, or null past `MAX_EDITS`.
 * The forward pass records, for each distance d, the furthest x reached
 * on each diagonal k; the walk back reads the script off those records.
 */
function myers(a: readonly string[], b: readonly string[]): Edit[] | null {
  const n = a.length;
  const m = b.length;
  const offset = MAX_EDITS + 1;
  const width = 2 * offset + 1;
  const v = new Int32Array(width);
  const trace: Int32Array[] = [];
  let found = -1;
  for (let d = 0; d <= Math.min(MAX_EDITS, n + m); d += 1) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      const down =
        k === -d ||
        (k !== d && (v[offset + k - 1] ?? 0) < (v[offset + k + 1] ?? 0));
      let x = down ? (v[offset + k + 1] ?? 0) : (v[offset + k - 1] ?? 0) + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x += 1;
        y += 1;
      }
      v[offset + k] = x;
      if (x >= n && y >= m) {
        found = d;
        break;
      }
    }
    if (found >= 0) break;
  }
  if (found < 0) return null;

  const edits: Edit[] = [];
  let x = n;
  let y = m;
  for (let d = found; d > 0; d -= 1) {
    const before = trace[d] ?? v;
    const k = x - y;
    const down =
      k === -d ||
      (k !== d &&
        (before[offset + k - 1] ?? 0) < (before[offset + k + 1] ?? 0));
    const previousK = down ? k + 1 : k - 1;
    const previousX = before[offset + previousK] ?? 0;
    const previousY = previousX - previousK;
    while (x > previousX && y > previousY) {
      x -= 1;
      y -= 1;
      edits.push({ kind: "same", token: a[x] ?? "" });
    }
    if (down) {
      y -= 1;
      edits.push({ kind: "added", token: b[y] ?? "" });
    } else {
      x -= 1;
      edits.push({ kind: "removed", token: a[x] ?? "" });
    }
  }
  while (x > 0 && y > 0) {
    x -= 1;
    y -= 1;
    edits.push({ kind: "same", token: a[x] ?? "" });
  }
  return edits.reverse();
}

/** Runs of edits of one kind, joined. */
function runs(edits: readonly Edit[]): WordPart[] {
  const parts: { kind: WordPart["kind"]; text: string }[] = [];
  for (const { kind, token } of edits) {
    const last = parts.at(-1);
    if (last && last.kind === kind) last.text += token;
    else parts.push({ kind, text: token });
  }
  return parts;
}

/**
 * `before` to `after` word by word, or null when either has more than
 * 1,500 words or they differ by more than 500 (show both whole instead).
 */
export function wordDiff(
  before: string,
  after: string
): readonly WordPart[] | null {
  const a = tokens(before);
  const b = tokens(after);
  if (a.length > MAX_TOKENS || b.length > MAX_TOKENS) return null;
  // What both begin and end with needs no search.
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) {
    start += 1;
  }
  let end = 0;
  while (
    end < a.length - start &&
    end < b.length - start &&
    a[a.length - 1 - end] === b[b.length - 1 - end]
  ) {
    end += 1;
  }
  const middle = myers(
    a.slice(start, a.length - end),
    b.slice(start, b.length - end)
  );
  if (middle === null) return null;
  return runs([
    ...a.slice(0, start).map(token => ({ kind: "same" as const, token })),
    ...middle,
    ...a.slice(a.length - end).map(token => ({ kind: "same" as const, token })),
  ]);
}
