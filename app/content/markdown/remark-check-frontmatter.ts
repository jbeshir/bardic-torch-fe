import type { Root } from "mdast";
import { parse } from "yaml";
import { helpFrontmatterSchema } from "../help/frontmatter";

/**
 * Fails the build when a page's front matter is missing or doesn't match
 * helpFrontmatterSchema, so the app can trust its type without shipping a
 * validator.
 */
export function remarkCheckFrontmatter() {
  return (tree: Root, file: { path?: string }) => {
    const [first] = tree.children;
    const where = file.path ?? "a Markdown page";
    if (first?.type !== "yaml") {
      throw new Error(`${where} has no front matter`);
    }
    const parsed = helpFrontmatterSchema.safeParse(parse(first.value));
    if (!parsed.success) {
      throw new Error(
        `${where} has invalid front matter:\n${parsed.error.issues
          .map(
            ({ path, message }) => `- ${path.join(".") || "(root)"}: ${message}`
          )
          .join("\n")}`
      );
    }
  };
}
