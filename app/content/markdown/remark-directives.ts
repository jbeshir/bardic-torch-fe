import type { Paragraph, Parent, Root, RootContent } from "mdast";
import type { ContainerDirective } from "mdast-util-directive";

/**
 * The container directives help pages may use (DESIGN §10.2), each turned
 * into the element the component map renders:
 *
 * - `:::note` and `:::warning`: an info or warning Alert;
 * - `:::infobox{title="At a glance"}`: the page's Infobox, from a list of
 *   "**Label:** value" items;
 * - `:::cards`: the help index's link cards, from a list of
 *   "[Title](/help/slug): description" items.
 *
 * Any other directive, a missing infobox title, or text directives (which
 * would otherwise vanish silently, e.g. "Note:3 places") fail the build.
 */
const ELEMENTS = {
  note: "note",
  warning: "warning",
  infobox: "infobox",
  cards: "cardlist",
} as const;

function isDirectiveName(name: string): name is keyof typeof ELEMENTS {
  return Object.hasOwn(ELEMENTS, name);
}

function convert(node: ContainerDirective): void {
  if (!isDirectiveName(node.name)) {
    throw new Error(`Unknown directive ":::${node.name}"`);
  }
  const title = node.attributes?.["title"];
  if (node.name === "infobox" && !title) {
    throw new Error(':::infobox needs a title, e.g. {title="At a glance"}');
  }
  node.data = {
    hName: ELEMENTS[node.name],
    hProperties: title ? { title } : {},
  };
  // An alert's single paragraph is its body, not a paragraph in the prose.
  const [only] = node.children;
  if (node.children.length === 1 && only?.type === "paragraph") {
    (only as Paragraph).data = { hName: "span" };
  }
}

function walk(parent: Parent): void {
  for (const child of parent.children as RootContent[]) {
    if (child.type === "containerDirective") {
      convert(child);
    } else if (
      child.type === "leafDirective" ||
      child.type === "textDirective"
    ) {
      throw new Error(
        `Unexpected directive ":${child.name}": write it as text, or escape the colon`
      );
    }
    if ("children" in child) {
      walk(child);
    }
  }
}

export function remarkDirectives() {
  return (tree: Root) => {
    walk(tree);
  };
}
