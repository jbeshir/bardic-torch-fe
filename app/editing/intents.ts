/**
 * What an editor form's submit button asks for (`name="intent"`): to
 * preview, to submit, or to add or remove a row without JavaScript
 * (`add:links.0.performances`, `remove:credits.2`). The row buttons work on
 * the unflattened form, before the document is parsed, so an added row is
 * `{}` and the schema fills in its blank values. Anything else is a
 * preview, as Enter is (the form's hidden first button).
 */

export type Intent =
  | { readonly kind: "preview" | "submit" }
  | { readonly kind: "add"; readonly path: readonly string[] }
  | {
      readonly kind: "remove";
      readonly path: readonly string[];
      readonly index: number;
    };

const ROW = /^(add|remove):([a-z_]+(?:\.(?:[a-z_]+|\d+))*)$/;

export function parseIntent(value: string | null): Intent {
  if (value === "submit") return { kind: "submit" };
  const match = ROW.exec(value ?? "");
  if (!match?.[1] || !match[2]) return { kind: "preview" };
  const path = match[2].split(".");
  if (match[1] === "add") return { kind: "add", path };
  const index = Number(path.pop());
  return Number.isInteger(index)
    ? { kind: "remove", path, index }
    : { kind: "preview" };
}

/** `tree` with `change` made to the list at `path` (a missing list is []). */
function changeList(
  tree: unknown,
  path: readonly string[],
  change: (list: readonly unknown[]) => unknown[]
): unknown {
  const [key, ...rest] = path;
  if (key === undefined) {
    return change(
      Array.isArray(tree) ? tree : tree === undefined ? [] : [tree]
    );
  }
  if (Array.isArray(tree)) {
    return tree.map((item, index) =>
      String(index) === key ? changeList(item, rest, change) : item
    );
  }
  if (typeof tree !== "object" || tree === null) return tree;
  const record = tree as Readonly<Record<string, unknown>>;
  return { ...record, [key]: changeList(record[key], rest, change) };
}

/** The unflattened form with the intent's row added or removed. */
export function applyIntent(tree: unknown, intent: Intent): unknown {
  switch (intent.kind) {
    case "add":
      return changeList(tree, intent.path, list => [...list, undefined]);
    case "remove":
      return changeList(tree, intent.path, list =>
        list.filter((_item, index) => index !== intent.index)
      );
    default:
      return tree;
  }
}
