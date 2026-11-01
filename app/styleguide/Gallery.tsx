import { Buttons, Links } from "./Actions";
import { Cards, Infoboxes, Tags } from "./Content";
import { Alerts, EmptyStates, ErrorStates, Loading, Toasts } from "./Feedback";
import {
  Checkboxes,
  ErrorSummaries,
  Inputs,
  Selects,
  Textareas,
} from "./Forms";
import { Colours, Logo, SpacingAndShape, TypeScale } from "./Foundations";
import { Crumbs, Pages, PageTabs } from "./Navigation";
import { Dialogs, Drawers, Theme } from "./Overlays";
import {
  AccountMenus,
  Contents,
  Help,
  PageTemplate,
  SearchBoxes,
} from "./Shell";
import { AnchorPrefix } from "./Specimen";

/**
 * Every block on the page, in DESIGN order, with its anchor. The e2e
 * checkpoints are declared from this list (e2e/support/checkpoints.ts).
 */
export const SPECIMENS = [
  { id: "colour", title: "Colour", Block: Colours },
  { id: "type", title: "Type scale", Block: TypeScale },
  {
    id: "spacing",
    title: "Spacing, radii and elevation",
    Block: SpacingAndShape,
  },
  { id: "logo", title: "Logo", Block: Logo },
  { id: "button", title: "Button", Block: Buttons },
  { id: "link", title: "Link", Block: Links },
  { id: "input", title: "Field and Input", Block: Inputs },
  { id: "textarea", title: "Textarea", Block: Textareas },
  { id: "select", title: "Select", Block: Selects },
  { id: "checkbox", title: "Checkbox", Block: Checkboxes },
  { id: "error-summary", title: "Error summary", Block: ErrorSummaries },
  { id: "tabs", title: "Tabs", Block: PageTabs },
  { id: "infobox", title: "Infobox", Block: Infoboxes },
  { id: "card", title: "Card", Block: Cards },
  { id: "tag-list", title: "Chip and TagList", Block: Tags },
  { id: "alert", title: "Alert and Banner", Block: Alerts },
  { id: "empty-state", title: "Empty state", Block: EmptyStates },
  { id: "error-state", title: "Error state", Block: ErrorStates },
  { id: "loading", title: "Spinner and Skeleton", Block: Loading },
  { id: "breadcrumbs", title: "Breadcrumbs", Block: Crumbs },
  { id: "pagination", title: "Pagination", Block: Pages },
  { id: "drawer", title: "Drawer", Block: Drawers },
  { id: "dialog", title: "Dialog", Block: Dialogs },
  { id: "toast", title: "Toast", Block: Toasts },
  { id: "theme-toggle", title: "ThemeToggle", Block: Theme },
  { id: "account-menu", title: "AccountMenu", Block: AccountMenus },
  { id: "search-box", title: "SearchBox", Block: SearchBoxes },
  { id: "table-of-contents", title: "Table of contents", Block: Contents },
  { id: "help-links", title: "HelpLinks", Block: Help },
  { id: "page-template", title: "Wiki page", Block: PageTemplate },
] as const;

/**
 * One copy of the whole gallery. `anchorPrefix` keeps its ids apart from
 * the other preview panels' copies.
 */
export function Gallery({
  anchorPrefix = "",
}: {
  readonly anchorPrefix?: string;
}) {
  return (
    <AnchorPrefix.Provider value={anchorPrefix}>
      {SPECIMENS.map(({ id, Block }) => (
        <Block key={id} />
      ))}
    </AnchorPrefix.Provider>
  );
}
