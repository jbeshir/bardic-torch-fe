import { useLocation } from "react-router";
import { IconBook2 } from "@tabler/icons-react";
import { useId, type ComponentProps, type ReactNode } from "react";
import { Breadcrumbs } from "~/components/ui/Breadcrumbs";
import { ViewTabs } from "~/components/ui/Tabs";
import { TagList } from "~/components/ui/TagList";
import { TableOfContents, type TocEntry } from "./TableOfContents";

/**
 * The wiki page template, inside the shell's main
 * sheet: breadcrumbs, the h1, the subtitle, the title rule with the page's
 * views (by default the non-interactive "Read" label: a help page has one
 * view) and its meta, the page's banners, then the infobox (first, so it
 * floats right from md and stacks above the prose below), the intro, the
 * contents, the prose, the category chips and the licence line. Catalogue
 * pages use it through EntityPage.
 */
export function WikiPage({
  title,
  breadcrumbs,
  subtitle,
  views,
  banners,
  meta,
  infobox,
  intro,
  contents,
  categories,
  licence,
  children,
}: {
  readonly title: string;
  readonly breadcrumbs?: ComponentProps<typeof Breadcrumbs>;
  /** The meta line under the h1: "Song · Dance music · 1580–1600". */
  readonly subtitle?: ReactNode;
  /** The page's views on the title rule; the current one is the path. */
  readonly views?: ComponentProps<typeof ViewTabs>["views"];
  /** Page-level states under the title rule (PageBanner). */
  readonly banners?: ReactNode;
  /** At the right end of the title rule: e.g. the source link. */
  readonly meta?: ReactNode;
  /** An Infobox. */
  readonly infobox?: ReactNode;
  /** The prose before the contents. */
  readonly intro?: ReactNode;
  /** The page's h2s (and h3s); shown as the contents from four h2s. */
  readonly contents?: readonly TocEntry[];
  readonly categories?: ComponentProps<typeof TagList>["tags"];
  /** The page's licence and credit line, at the very end. */
  readonly licence?: ReactNode;
  readonly children: ReactNode;
}) {
  const { pathname } = useLocation();
  const categoriesId = useId();
  return (
    <>
      {breadcrumbs ? (
        <div className="mb-2">
          <Breadcrumbs {...breadcrumbs} />
        </div>
      ) : null}
      <h1 className="text-h1 text-fg">{title}</h1>
      {subtitle ? (
        <p className="mt-1 text-body-sm text-fg-muted">{subtitle}</p>
      ) : null}
      <div className="mt-4">
        <ViewTabs
          views={views ?? [{ label: "Read", to: pathname, icon: IconBook2 }]}
          current={pathname}
          meta={meta}
        />
      </div>
      {banners ? <div className="mt-6 grid gap-3">{banners}</div> : null}
      <div className="mt-6 flow-root">
        {infobox}
        <div className="prose-bt">
          {intro}
          {contents && contents.length >= 4 ? (
            <TableOfContents entries={contents} />
          ) : null}
          {children}
        </div>
      </div>
      {categories ? (
        <nav
          aria-labelledby={categoriesId}
          className="mt-10 border-t border-border pt-6"
        >
          <h2
            id={categoriesId}
            className="mb-3 font-sans text-label-caps uppercase text-fg-subtle"
          >
            Categories
          </h2>
          <TagList tags={categories} />
        </nav>
      ) : null}
      {licence ? (
        <p className="mt-6 text-caption text-fg-subtle">{licence}</p>
      ) : null}
    </>
  );
}
