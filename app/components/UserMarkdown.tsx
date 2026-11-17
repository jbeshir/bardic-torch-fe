import type { ReactNode } from "react";
import { isUserUrl } from "~/catalogue/user-url";
import { Link, linkClasses } from "~/components/ui/Link";
import type {
  MarkdownBlock,
  MarkdownInline,
  MarkdownTree,
} from "~/schemas/markdown";

/**
 * Renders `nodes` one after another: the first, then the rest the same
 * way. A node has no identity but its place in a tree that never changes,
 * so there is no list to key.
 */
function Each<Node>({
  nodes,
  render,
}: {
  readonly nodes: readonly Node[];
  readonly render: (node: Node) => ReactNode;
}) {
  const [first, ...rest] = nodes;
  if (first === undefined) return null;
  return (
    <>
      {render(first)}
      <Each nodes={rest} render={render} />
    </>
  );
}

function Inlines({ nodes }: { readonly nodes: readonly MarkdownInline[] }) {
  return <Each nodes={nodes} render={node => <Inline node={node} />} />;
}

function Inline({ node }: { readonly node: MarkdownInline }) {
  switch (node.type) {
    case "text":
      return node.value;
    case "inlineCode":
      return <code>{node.value}</code>;
    case "break":
      return <br />;
    case "emphasis":
      return (
        <em>
          <Inlines nodes={node.children} />
        </em>
      );
    case "strong":
      return (
        <strong>
          <Inlines nodes={node.children} />
        </strong>
      );
    case "link":
      // A reader's address: never followed or credited.
      return isUserUrl(node.href) ? (
        <Link to={node.href} userContent appearance="prose">
          <Inlines nodes={node.children} />
        </Link>
      ) : (
        <a
          href={node.href}
          rel="nofollow ugc noopener"
          className={linkClasses("prose")}
        >
          <Inlines nodes={node.children} />
        </a>
      );
  }
}

function Blocks({ nodes }: { readonly nodes: readonly MarkdownBlock[] }) {
  return <Each nodes={nodes} render={node => <Block node={node} />} />;
}

const HEADINGS = { 3: "h3", 4: "h4", 5: "h5", 6: "h6" } as const;

function Block({ node }: { readonly node: MarkdownBlock }) {
  switch (node.type) {
    case "paragraph":
      return (
        <p>
          <Inlines nodes={node.children} />
        </p>
      );
    case "heading": {
      const Heading = HEADINGS[node.level];
      return (
        <Heading>
          <Inlines nodes={node.children} />
        </Heading>
      );
    }
    case "list": {
      const items = (
        <Each
          nodes={node.items}
          render={item => (
            <li>
              <Blocks nodes={item} />
            </li>
          )}
        />
      );
      return node.ordered ? (
        <ol start={node.start ?? undefined}>{items}</ol>
      ) : (
        <ul>{items}</ul>
      );
    }
    case "blockquote":
      return (
        <blockquote>
          <Blocks nodes={node.children} />
        </blockquote>
      );
    case "code":
      return (
        <pre>
          <code>{node.value}</code>
        </pre>
      );
    case "thematicBreak":
      return <hr />;
  }
}

/**
 * A reader's Markdown (an API `*_md` field), from the sanitised tree its
 * loader made of it (`renderMarkdown`): plain elements the prose
 * styles (`.prose-bt`, around it) dress, links through our `Link` as a
 * reader's URLs (`nofollow ugc`). Nothing here parses Markdown or HTML.
 */
export function UserMarkdown({ tree }: { readonly tree: MarkdownTree }) {
  return <Blocks nodes={tree} />;
}
