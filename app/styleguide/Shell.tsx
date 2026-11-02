import { AccountMenu } from "~/components/AccountMenu";
import { HelpLinks } from "~/components/HelpLinks";
import { SearchBox } from "~/components/SearchBox";
import { TableOfContents } from "~/components/TableOfContents";
import { WikiPage } from "~/components/WikiPage";
import { Infobox } from "~/components/ui/Infobox";
import { Link } from "~/components/ui/Link";
import { wikiPageUrl } from "~/constants/navigation";
import { useContext, type ReactNode } from "react";
import { AnchorPrefixContext, Example, Specimen } from "./Specimen";

const MORWEN = {
  state: "signed-in",
  user: {
    id: "fixture|contributor",
    display_name: "Morwen of the Marches",
    role: "contributor",
  },
} as const;

/** Contents for the examples, their ids kept apart per gallery copy. */
function useContents() {
  const prefix = `${useContext(AnchorPrefixContext)}sg-`;
  return [
    { id: `${prefix}low-risk`, label: "Low risk" },
    {
      id: `${prefix}endangered`,
      label: "Endangered",
      children: [
        { id: `${prefix}three-places`, label: "Exactly three places" },
      ],
    },
    { id: `${prefix}critical`, label: "Critically endangered" },
    { id: `${prefix}restricted`, label: "Restricted" },
  ];
}

/**
 * At the right of its example, as in the header: the panel opens leftwards
 * from the trigger's right edge, so it stays on screen at 360.
 */
function HeaderEnd({ children }: { readonly children: ReactNode }) {
  return <div className="flex w-full justify-end">{children}</div>;
}

export function AccountMenus() {
  return (
    <Specimen
      id="account-menu"
      title="AccountMenu"
      summary="The account control in the header and the bottom bar (DESIGN §6.25): Log in, or a disclosure with the profile, Settings and Log out. Open one to see its panel."
    >
      <Example label="Signed out">
        <HeaderEnd>
          <AccountMenu account={{ state: "signed-out" }} placement="header" />
        </HeaderEnd>
      </Example>
      <Example label="Signed in">
        <HeaderEnd>
          <AccountMenu account={MORWEN} placement="header" />
        </HeaderEnd>
      </Example>
      <Example label="Profile couldn’t load">
        <HeaderEnd>
          <AccountMenu
            account={{ state: "profile-unavailable" }}
            placement="header"
          />
        </HeaderEnd>
      </Example>
      <Example label="Blocked account">
        <HeaderEnd>
          <AccountMenu
            account={{
              state: "blocked",
              message:
                "Your account is blocked, so you can’t make changes. Contact the Bardic Torch team if you think this is a mistake.",
            }}
            placement="header"
          />
        </HeaderEnd>
      </Example>
    </Specimen>
  );
}

export function SearchBoxes() {
  return (
    <Specimen
      id="search-box"
      title="SearchBox"
      summary="Searches the original wiki with a plain GET form (DESIGN §6.26)."
    >
      <Example label="Header (40 px)" stack>
        <SearchBox size="md" />
      </Example>
      <Example label="Drawer, search sheet and home (44 px)" stack>
        <SearchBox size="lg" />
      </Example>
    </Specimen>
  );
}

export function Contents() {
  const contents = useContents();
  return (
    <Specimen
      id="table-of-contents"
      title="Table of contents"
      summary="A help page’s numbered contents, from four h2s (DESIGN §6.27). Folded below md."
    >
      <Example label="Open" wide>
        <TableOfContents entries={contents} />
      </Example>
    </Specimen>
  );
}

export function Help() {
  return (
    <Specimen
      id="help-links"
      title="HelpLinks"
      summary="The same help links in the same order on every page, the error page included (DESIGN §5.7, WCAG 3.2.6)."
    >
      <Example label="In the footer" wide>
        <HelpLinks />
      </Example>
    </Specimen>
  );
}

export function PageTemplate() {
  const contents = useContents();
  return (
    <Specimen
      id="page-template"
      title="Wiki page"
      summary="The page template (DESIGN §5.4–5.6, §10.2): breadcrumbs, title, Read label on the title rule, infobox, contents, prose, categories and licence."
    >
      <Example label="A help page" wide>
        <div className="w-full rounded-lg border border-border bg-surface p-4 md:p-8">
          <WikiPage
            title="Conservation status"
            breadcrumbs={{
              trail: [{ label: "Help", to: "/help" }],
              current: "Conservation status",
            }}
            meta={
              <Link
                to={wikiPageUrl("Category:Conservation Status")}
                appearance="muted"
              >
                Adapted from the original wiki
              </Link>
            }
            infobox={
              <Infobox
                title="At a glance"
                sections={[
                  {
                    heading: "Statuses",
                    rows: [
                      { label: "Low risk", value: "Four or more places" },
                      { label: "Endangered", value: "Exactly three places" },
                    ],
                  },
                ]}
              />
            }
            intro={
              <p>
                Conservation statuses flag works that may need more help to keep
                them alive.
              </p>
            }
            contents={contents}
            categories={[
              { label: "Help", to: "/help" },
              {
                label: "Conservation",
                to: wikiPageUrl("Category:Conservation Status"),
              },
            ]}
            licence="This page is available under CC BY-SA 4.0. Adapted from ‘Conservation Status’ on the original Bardic Torch wiki by its contributors."
          >
            <h2 id={contents[0]?.id}>Low risk</h2>
            <p>
              A work is low risk if it can be found in at least four places.
            </p>
          </WikiPage>
        </div>
      </Example>
    </Specimen>
  );
}
