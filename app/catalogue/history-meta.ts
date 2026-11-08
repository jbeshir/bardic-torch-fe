import type { MetaArgs, MetaDescriptor } from "react-router";
import { failureTitle } from "~/components/catalogue/CatalogueError";
import { SERVER_ERROR_META } from "~/components/ErrorPages";
import type { PageQueryState } from "./query-state";
import { thrownPageFailure } from "./read-failure";
import { pageMeta } from "./seo";

/**
 * The meta of an entity's History view (plan §4.11): "History of {name}"
 * (", page 2"), named from the layout's data, canonical to itself and
 * `noindex, follow`; a failure titled like its boundary's h1.
 */
export function historyMeta(
  args: MetaArgs,
  {
    name,
    path,
    missing,
  }: {
    /** The entity's name, from its layout's data; undefined if not loaded. */
    readonly name: string | undefined;
    /** The History view's path. */
    readonly path: `/${string}`;
    /** What a 404 says is missing: "that category". */
    readonly missing: string;
  }
): MetaDescriptor[] {
  if (args.error) {
    const thrown = thrownPageFailure(args.error) ?? { kind: "server" };
    return [
      {
        title: `${failureTitle(thrown, "the history", missing)} · Bardic Torch`,
      },
      { name: "robots", content: "noindex" },
    ];
  }
  const loaded = args.loaderData as
    { readonly state: PageQueryState; readonly canonical: string } | undefined;
  if (!loaded || name === undefined) return [...SERVER_ERROR_META];
  return pageMeta(args, {
    title:
      loaded.state.page > 1
        ? `History of ${name}, page ${loaded.state.page}`
        : `History of ${name}`,
    description: `The approved revisions of ${name} in the Bardic Torch catalogue, newest first, with who made each.`,
    path: `${path}${loaded.canonical}`,
    robots: "noindex, follow",
  });
}

/** The data of the route `id` among the meta args' matches. */
export function matchData(args: MetaArgs, id: string): unknown {
  return args.matches.find(match => match?.id === id)?.loaderData;
}
