import { IconBook2, IconHistory } from "@tabler/icons-react";
import type { ComponentProps, ReactNode } from "react";
import { WikiPage } from "./WikiPage";

type WikiPageProps = ComponentProps<typeof WikiPage>;

/**
 * A catalogue entity's page (plan §4.5, §4.6): the wiki page
 * template with the entity's two views on the title rule, Read (`path`) and
 * History (`{path}/history`), and its banners under it. Editing is FE3, so
 * there is no Edit view. `history: false` leaves the History view out (a
 * person who asked not to have a page), leaving the single Read label.
 */
export function EntityPage({
  path,
  history = true,
  ...page
}: Omit<WikiPageProps, "views" | "meta"> & {
  /** The entity's Read address: `/pieces/the-copper-kettle`. */
  readonly path: string;
  readonly history?: boolean;
  readonly children: ReactNode;
}) {
  const read = { label: "Read", to: path, icon: IconBook2 };
  return (
    <WikiPage
      {...page}
      views={
        history
          ? [
              read,
              { label: "History", to: `${path}/history`, icon: IconHistory },
            ]
          : [read]
      }
    />
  );
}
