import { valueToEstree } from "estree-util-value-to-estree";
import type { Element, ElementContent, Root, RootContent, Text } from "hast";
import type { MdxjsEsmHast } from "mdast-util-mdxjs-esm";

/**
 * Shapes a compiled help page for the WikiPage template (DESIGN §10.2):
 *
 * - every h2 and h3 gets an id from its text (the same slugs GitHub uses, so
 *   in-page links such as `#how-restricted-works` keep working), and the
 *   module exports them as `contents` for the table of contents;
 * - every table body row gets an id from its first cell, its words joined
 *   by underscores like an API enum value (`#low_risk`);
 * - the infobox's and the cards' lists become their facts and cards;
 * - the page is split into three `pageslot` elements (`infobox`, `intro`:
 *   everything before the first h2, and `body`), so the template can put
 *   each where it belongs: the infobox first and outside the prose, the
 *   contents after the intro.
 */

type Section = { readonly id: string; readonly label: string };
type ContentsEntry = Section & { readonly children?: readonly Section[] };

const isWhitespace = (node: RootContent | ElementContent) =>
  node.type === "text" && node.value.trim() === "";

const isElement = (
  node: RootContent | ElementContent,
  tagName?: string
): node is Element =>
  node.type === "element" &&
  (tagName === undefined || node.tagName === tagName);

function textOf(node: RootContent | ElementContent): string {
  if (node.type === "text") {
    return node.value;
  }
  return "children" in node ? node.children.map(textOf).join("") : "";
}

/** GitHub-style heading slugs: lower case, punctuation dropped, spaces to hyphens. */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .trim()
    .replace(/\s/g, "-");
}

function element(
  tagName: string,
  children: ElementContent[],
  properties: Element["properties"] = {}
): Element {
  return { type: "element", tagName, properties, children };
}

/** Drops the separator (": ") left at the start of an item's value. */
function trimLeadingSeparator(nodes: ElementContent[]): ElementContent[] {
  const [first, ...rest] = nodes;
  if (first?.type !== "text") {
    return nodes;
  }
  const value = first.value.replace(/^\s*:?\s*/, "");
  return value ? [{ ...first, value }, ...rest] : rest;
}

/** Drops the colon at the end of a bold label ("**Licence:**"). */
function trimTrailingColon(nodes: ElementContent[]): ElementContent[] {
  const last = nodes.at(-1);
  if (last?.type !== "text") {
    return nodes;
  }
  const trimmed: Text = { ...last, value: last.value.replace(/:\s*$/, "") };
  return [...nodes.slice(0, -1), trimmed];
}

/** An item's parts: its leading bold text or link, and the rest. */
function splitItem(item: Element, directive: string) {
  const [lead, ...rest] = item.children.filter(child => !isWhitespace(child));
  if (!lead || !(isElement(lead, "strong") || isElement(lead, "a"))) {
    throw new Error(
      `Each ${directive} item starts with bold text or a link: "${textOf(item)}"`
    );
  }
  return { lead, rest: trimLeadingSeparator(rest) };
}

/** The directive's one list, as its items. */
function listItems(directive: Element): Element[] {
  const blocks = directive.children.filter(child => !isWhitespace(child));
  const [list] = blocks;
  if (blocks.length !== 1 || !list || !isElement(list, "ul")) {
    throw new Error(`:::${directive.tagName} holds exactly one bulleted list`);
  }
  return list.children.filter((child): child is Element =>
    isElement(child, "li")
  );
}

/** "**Label:** value" items → infoboxfacts > infoboxfact > label + value. */
function toFacts(infobox: Element): void {
  const facts = listItems(infobox).map(item => {
    const { lead, rest } = splitItem(item, "infobox");
    const label =
      lead.tagName === "strong" ? trimTrailingColon(lead.children) : [lead];
    return element("infoboxfact", [
      element("infoboxlabel", label),
      element("infoboxvalue", rest),
    ]);
  });
  infobox.children = [element("infoboxfacts", facts)];
}

/** "[Title](/path): description" items → cardlist > card{title,to}. */
function toCards(cardList: Element): void {
  cardList.children = listItems(cardList).map(item => {
    const { lead, rest } = splitItem(item, "cards");
    const to = lead.properties["href"];
    if (lead.tagName !== "a" || typeof to !== "string" || !to.startsWith("/")) {
      throw new Error(`Each card is an internal link: "${textOf(item)}"`);
    }
    return element("card", rest, { title: textOf(lead), to });
  });
}

/** A slug from `text`, numbered if the page already has it ("x-1"). */
function uniqueId(text: string, used: Map<string, number>): string {
  const base = slugify(text);
  const count = used.get(base) ?? 0;
  used.set(base, count + 1);
  return count === 0 ? base : `${base}-${count}`;
}

/** Gives h2s and h3s their ids and lists them, h3s under their h2. */
function collectContents(
  nodes: readonly ElementContent[],
  used: Map<string, number>
): ContentsEntry[] {
  const entries: { id: string; label: string; children: Section[] }[] = [];
  for (const node of nodes) {
    if (!isElement(node, "h2") && !isElement(node, "h3")) {
      continue;
    }
    const label = textOf(node).trim();
    const id = uniqueId(label, used);
    node.properties["id"] = id;
    if (node.tagName === "h2") {
      entries.push({ id, label, children: [] });
    } else {
      // An h3's number already says where it is ("3.1"), so a numbered
      // heading ("1. Licensing") drops its own number in the contents.
      entries
        .at(-1)
        ?.children.push({ id, label: label.replace(/^\d+\.\s+/, "") });
    }
  }
  return entries.map(({ children, ...entry }) =>
    children.length > 0 ? { ...entry, children } : entry
  );
}

/**
 * Each body row of a table gets an id from its first cell, its words joined
 * by underscores ("Low Risk" → `#low_risk`), so a page can link to one
 * entry of a table, and an entry named like an API enum value has that
 * value as its anchor: the conservation statuses' rows are the targets of
 * every ConservationBadge link (DESIGN §6.13). Underscores also keep rows
 * apart from heading ids, which are hyphenated.
 */
function idTableRows(
  nodes: readonly ElementContent[],
  used: Map<string, number>
): void {
  for (const node of nodes) {
    if (node.type !== "element") continue;
    if (node.tagName !== "tbody") {
      idTableRows(node.children, used);
      continue;
    }
    for (const row of node.children) {
      if (!isElement(row, "tr")) continue;
      const [cell] = row.children.filter(child => isElement(child));
      if (cell) {
        const words = textOf(cell).trim().replace(/\s+/g, "_");
        row.properties["id"] = uniqueId(words, used);
      }
    }
  }
}

function exportContents(contents: readonly ContentsEntry[]): MdxjsEsmHast {
  return {
    type: "mdxjsEsm",
    value: "",
    data: {
      estree: {
        type: "Program",
        sourceType: "module",
        body: [
          {
            type: "ExportNamedDeclaration",
            specifiers: [],
            attributes: [],
            declaration: {
              type: "VariableDeclaration",
              kind: "const",
              declarations: [
                {
                  type: "VariableDeclarator",
                  id: { type: "Identifier", name: "contents" },
                  init: valueToEstree(contents),
                },
              ],
            },
          },
        ],
      },
    },
  };
}

export function rehypeHelpPage() {
  return (tree: Root) => {
    const esm = tree.children.filter(node => node.type === "mdxjsEsm");
    const blocks = tree.children.filter(
      (node): node is ElementContent =>
        node.type !== "mdxjsEsm" &&
        node.type !== "doctype" &&
        !isWhitespace(node)
    );
    const used = new Map<string, number>();
    const contents = collectContents(blocks, used);
    idTableRows(blocks, used);

    const infobox: ElementContent[] = [];
    const intro: ElementContent[] = [];
    const body: ElementContent[] = [];
    let inBody = false;
    for (const node of blocks) {
      inBody ||= isElement(node, "h2");
      if (isElement(node, "infobox")) {
        toFacts(node);
        infobox.push(node);
        continue;
      }
      if (isElement(node, "cardlist")) {
        toCards(node);
      }
      (inBody ? body : intro).push(node);
    }

    tree.children = [
      ...esm,
      exportContents(contents),
      element("pageslot", infobox, { name: "infobox" }),
      element("pageslot", intro, { name: "intro" }),
      element("pageslot", body, { name: "body" }),
    ];
  };
}
