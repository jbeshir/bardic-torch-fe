import { IconMenu2, IconSearch } from "@tabler/icons-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "~/components/ui/Button";
import type { Account } from "~/constants/account";
import { useDismiss } from "~/hooks/useDismiss";
import { AccountMenu, BAR_CELL } from "./AccountMenu";
import { SearchBox } from "./SearchBox";

/**
 * The control that opens the site menu (DESIGN §6.21): a ghost icon button
 * in the header at md–lg, the Menu cell of the bottom bar below md. Until
 * the page is hydrated (and without JS) it is a link to the site menu after
 * the content; then a button that opens the drawer, which gives focus back
 * to it on close.
 */
export function MenuControl({
  look,
  hydrated,
  drawerId,
  siteNavId,
  onOpen,
}: {
  look: "icon" | "cell";
  hydrated: boolean;
  drawerId: string;
  siteNavId: string;
  onOpen: () => void;
}) {
  const className =
    look === "cell"
      ? BAR_CELL
      : "inline-flex h-11 w-11 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface-sunken hover:text-fg";
  const inside = (
    <>
      <IconMenu2
        size={look === "cell" ? 24 : 20}
        stroke={1.75}
        aria-hidden="true"
      />
      <span className={look === "cell" ? undefined : "sr-only"}>Menu</span>
    </>
  );
  if (!hydrated) {
    return (
      <a href={`#${siteNavId}`} className={className}>
        {inside}
      </a>
    );
  }
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-controls={drawerId}
      onClick={onOpen}
      className={className}
    >
      {inside}
    </button>
  );
}

/**
 * Search in the bottom bar (DESIGN §5.2): with JS, a sheet just above the
 * bar with the wiki SearchBox, focused, and Cancel; Escape or Cancel close
 * it and return focus here. Without JS, a link to the site menu, which
 * starts with the SearchBox.
 */
function SearchCell({
  hydrated,
  siteNavId,
}: {
  hydrated: boolean;
  siteNavId: string;
}) {
  const [open, setOpen] = useState(false);
  const sheetId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) trigger.current?.focus();
  };
  useDismiss({ open, close, areas: [trigger, sheet] });
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  const inside = (
    <>
      <IconSearch size={24} stroke={1.75} aria-hidden="true" />
      Search
    </>
  );
  if (!hydrated) {
    return (
      <a href={`#${siteNavId}`} className={BAR_CELL}>
        {inside}
      </a>
    );
  }
  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls={sheetId}
        onClick={() => setOpen(!open)}
        className={BAR_CELL}
      >
        {inside}
      </button>
      <div
        ref={sheet}
        id={sheetId}
        hidden={!open}
        className="absolute inset-x-0 bottom-full border-t border-border bg-surface-raised p-3 shadow-2"
      >
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <SearchBox size="lg" ref={input} />
          </div>
          <Button variant="ghost" onClick={() => close(true)}>
            Cancel
          </Button>
        </div>
      </div>
    </>
  );
}

/**
 * The bottom app bar (DESIGN §5.2), below md only: Menu · Search · Account
 * in three equal cells, 56 px plus the safe-area inset, fixed to the bottom
 * of the viewport. It is part of the header in the DOM, so the Tab order is
 * logo → Menu → Search → Account → content. It is a group named "App bar"
 * (not a landmark), which sets its Menu, Search and Account apart from the
 * header's own copies. Only one set is ever rendered: the header's are
 * `display: none` below md, and the bar is `display: none` from md.
 */
export function BottomBar({
  account,
  hydrated,
  drawerId,
  siteNavId,
  onOpenMenu,
}: {
  account: Account;
  hydrated: boolean;
  drawerId: string;
  siteNavId: string;
  onOpenMenu: () => void;
}) {
  return (
    <div
      role="group"
      aria-label="App bar"
      className="fixed inset-x-0 bottom-0 z-header border-t border-border bg-surface-raised pb-safe-b shadow-2 md:hidden"
    >
      <div className="grid h-app-bar grid-cols-3">
        <MenuControl
          look="cell"
          hydrated={hydrated}
          drawerId={drawerId}
          siteNavId={siteNavId}
          onOpen={onOpenMenu}
        />
        <SearchCell hydrated={hydrated} siteNavId={siteNavId} />
        <AccountMenu account={account} placement="bar" />
      </div>
    </div>
  );
}
