import type { z } from "zod";
import { DOCUMENT_SCHEMAS, type EntityType } from "./documents";
import { applyIntent, type Intent, parseIntent } from "./intents";

/**
 * The editor form ↔ document codec (plan "One form ↔ document codec"). A
 * control's `name` is its document path with dots (`credits.2.role`), and
 * the same string is its `id`. `unflatten` turns the posted fields into a
 * tree (numeric keys into lists, repeated names into lists of values), the
 * intent adds or removes a row in it, and the type's schema
 * (documents.ts) makes the document.
 */

type Tree = { [key: string]: unknown };

/** Keys that would reach an object's prototype. */
const UNSAFE = new Set(["__proto__", "constructor", "prototype"]);

const isTree = (value: unknown): value is Tree =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Objects whose keys are all indexes, as lists in index order. */
function listed(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(listed);
  if (!isTree(value)) return value;
  const keys = Object.keys(value);
  if (keys.length > 0 && keys.every(key => /^\d+$/.test(key))) {
    return keys
      .sort((a, b) => Number(a) - Number(b))
      .map(key => listed(value[key]));
  }
  return Object.fromEntries(keys.map(key => [key, listed(value[key])]));
}

/**
 * The posted fields as a tree. Line breaks are the `\n` the API stores
 * (browsers send a textarea's as `\r\n`).
 */
function unflatten(fields: Iterable<readonly [string, string]>): Tree {
  const root: Tree = {};
  for (const [name, raw] of fields) {
    const keys = name.split(".");
    if (keys.some(key => key === "" || UNSAFE.has(key))) continue;
    const value = raw.replace(/\r\n?/g, "\n");
    const last = keys.pop() ?? "";
    let node = root;
    for (const key of keys) {
      const next = node[key];
      node = isTree(next) ? next : (node[key] = {});
    }
    const seen = node[last];
    node[last] = seen === undefined ? value : [seen, value].flat();
  }
  return listed(root) as Tree;
}

/** The control id of a problem's path: `credits[2].role` → `credits.2.role`. */
export const fieldId = (path: string) => path.replace(/\[(\d+)\]/g, ".$1");

export type DecodedForm<T extends EntityType> = {
  readonly intent: Intent;
  readonly document: z.output<(typeof DOCUMENT_SCHEMAS)[T]>;
  readonly summary: string;
  readonly baseRevisionId: number | null;
  readonly acknowledgeDuplicates: boolean;
  readonly acknowledgeStale: boolean;
};

/**
 * An editor form's fields as the submission they make, with the intent
 * applied; null when the document doesn't parse (a form we didn't make).
 */
export function decodeForm<T extends EntityType>(
  type: T,
  fields: URLSearchParams
): DecodedForm<T> | null {
  const intent = parseIntent(fields.get("intent"));
  const parsed = DOCUMENT_SCHEMAS[type].safeParse(
    applyIntent(unflatten(fields), intent)
  );
  if (!parsed.success) return null;
  const base = Number(fields.get("base_revision_id") ?? "");
  return {
    intent,
    document: parsed.data as z.output<(typeof DOCUMENT_SCHEMAS)[T]>,
    summary: fields.get("summary") ?? "",
    baseRevisionId: Number.isSafeInteger(base) && base > 0 ? base : null,
    acknowledgeDuplicates: fields.has("acknowledge_duplicates"),
    acknowledgeStale: fields.has("acknowledge_stale"),
  };
}
