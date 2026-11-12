import { IconBook2, IconHistory, IconPencil } from "@tabler/icons-react";
import type { ComponentProps, ReactNode } from "react";
import { PageBanner } from "./PageBanner";
import { WikiPage } from "./WikiPage";

type WikiPageProps = ComponentProps<typeof WikiPage>;

/**
 * A catalogue entity's page (plan §4.5, §4.6): the wiki page
 * template with the entity's views on the title rule, Read (`path`), Edit
 * (`{path}/edit`, shown to everyone: signing in comes after) and History
 * (`{path}/history`), and its banners under it. `history: false` leaves
 * the History view out (a person who asked not to have a page).
 */
export function EntityPage({
  path,
  history = true,
  pending = false,
  banners,
  ...page
}: Omit<WikiPageProps, "views" | "meta"> & {
  /** The entity's Read address: `/pieces/the-copper-kettle`. */
  readonly path: string;
  readonly history?: boolean;
  /** The reader has an edit of this page waiting for review. */
  readonly pending?: boolean | undefined;
  readonly children: ReactNode;
}) {
  const read = { label: "Read", to: path, icon: IconBook2 };
  const edit = { label: "Edit", to: `${path}/edit`, icon: IconPencil };
  const past = { label: "History", to: `${path}/history`, icon: IconHistory };
  return (
    <WikiPage
      {...page}
      views={history ? [read, edit, past] : [read, edit]}
      banners={
        <>
          {pending ? <PageBanner kind="pending" path={path} /> : null}
          {banners}
        </>
      }
    />
  );
}
