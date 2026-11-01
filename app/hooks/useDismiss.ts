import { useLocation } from "@remix-run/react";
import { useEffect, useRef, type RefObject } from "react";

/**
 * Closing rules for a non-modal popup (the account panel, the search
 * sheet; DESIGN §6.25): Escape closes it and gives focus back to its
 * trigger; a press or focus anywhere outside `areas` (the trigger and the
 * popup) closes it and leaves focus where it went; so does any navigation.
 */
export function useDismiss({
  open,
  close,
  areas,
}: {
  readonly open: boolean;
  /** Close; `returnFocus` is true when focus should go back to the trigger. */
  readonly close: (returnFocus: boolean) => void;
  readonly areas: readonly RefObject<HTMLElement>[];
}): void {
  const latest = useRef({ close, areas });
  latest.current = { close, areas };

  useEffect(() => {
    if (!open) return;
    const outside = (target: EventTarget | null) =>
      target instanceof Node &&
      !latest.current.areas.some(area => area.current?.contains(target));
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      latest.current.close(true);
    };
    const onOutside = (event: Event) => {
      if (outside(event.target)) latest.current.close(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onOutside);
    document.addEventListener("focusin", onOutside);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onOutside);
      document.removeEventListener("focusin", onOutside);
    };
  }, [open]);

  const { key } = useLocation();
  const shownAt = useRef(key);
  useEffect(() => {
    if (open && key !== shownAt.current) latest.current.close(false);
    shownAt.current = key;
  }, [open, key]);
}
