import { IconBook2 } from "@tabler/icons-react";
import type { ComponentProps, ReactNode } from "react";
import { WikiPage } from "./WikiPage";

type WikiPageProps = ComponentProps<typeof WikiPage>;

/**
 * A catalogue entity's page (plan §4.5, §4.6): the wiki page
 * template with the entity's views on the title rule, Read (`path`), and its
 * banners under it.
 */
export function EntityPage({
  path,
  ...page
}: Omit<WikiPageProps, "views" | "meta"> & {
  /** The entity's Read address: `/pieces/the-copper-kettle`. */
  readonly path: string;
  readonly children: ReactNode;
}) {
  const read = { label: "Read", to: path, icon: IconBook2 };
  return <WikiPage {...page} views={[read]} />;
}
