import { IconBook2, IconHistory, IconPencil } from "@tabler/icons-react";
import { Breadcrumbs } from "~/components/ui/Breadcrumbs";
import { Pagination } from "~/components/ui/Pagination";
import { Tabs, ViewTabs } from "~/components/ui/Tabs";
import { Example, Specimen } from "./Specimen";

const READ = { label: "Read", to: "/styleguide", icon: IconBook2 } as const;
const VIEWS = [
  READ,
  { label: "Edit", to: "/styleguide?view=edit", icon: IconPencil },
  { label: "History", to: "/styleguide?view=history", icon: IconHistory },
] as const;

const pageHref = (n: number) => `/styleguide?page=${n}#pagination`;

export function PageTabs() {
  return (
    <Specimen
      id="tabs"
      title="Tabs"
      summary="Page views on the title rule (DESIGN §6.9): one view is a plain Read label, two or more are a nav of links. The segmented tablist is for in-page panels."
    >
      <Example label="One view: the Read label (every FE1 page)" wide>
        <div className="w-full">
          <ViewTabs views={[READ]} current={READ.to} />
        </div>
      </Example>
      <Example label="Several views, with page meta" wide>
        <div className="w-full">
          <ViewTabs
            views={VIEWS}
            current={READ.to}
            meta="Last edited 3 Oct 2026"
          />
        </div>
      </Example>
      <Example label="In-page tablist" wide>
        <div className="w-full">
          <Tabs
            label="Piece details"
            panels={[
              {
                label: "Summary",
                content: (
                  <p className="text-body-sm text-fg">
                    A rousing chorus for the end of a revel.
                  </p>
                ),
              },
              {
                label: "Sources",
                content: (
                  <p className="text-body-sm text-fg">
                    First heard at a fireside in the Middle Kingdom.
                  </p>
                ),
              },
              {
                label: "Permissions",
                content: (
                  <p className="text-body-sm text-fg">
                    Ask the bard before recording it.
                  </p>
                ),
              },
            ]}
          />
        </div>
      </Example>
    </Specimen>
  );
}

export function Crumbs() {
  return (
    <Specimen
      id="breadcrumbs"
      title="Breadcrumbs"
      summary="Where a help page sits (DESIGN §6.19)."
    >
      <Example label="Two deep">
        <Breadcrumbs
          trail={[{ label: "Help", to: "/help" }]}
          current="Licence and attribution"
        />
      </Example>
      <Example label="Three deep, wrapping at 320 px">
        <Breadcrumbs
          trail={[
            { label: "Help", to: "/help" },
            { label: "Contributing", to: "/help/contributing" },
          ]}
          current="How to write a good piece summary"
        />
      </Example>
    </Specimen>
  );
}

export function Pages() {
  return (
    <Specimen
      id="pagination"
      title="Pagination"
      summary="Styleguide-only in FE1: links to the pages of a long list (DESIGN §6.20). Below sm it shows ‘Page n of m’."
    >
      <Example label="First page" wide>
        <Pagination page={1} pageCount={12} href={pageHref} />
      </Example>
      <Example label="Middle page" wide>
        <Pagination page={6} pageCount={12} href={pageHref} />
      </Example>
      <Example label="Last page" wide>
        <Pagination page={12} pageCount={12} href={pageHref} />
      </Example>
    </Specimen>
  );
}
