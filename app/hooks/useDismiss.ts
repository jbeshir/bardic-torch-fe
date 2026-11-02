import { useLocation } from "react-router";
import { useEffect, useRef, type RefObject } from "react";
import { useBrowserLayoutEffect } from "./useBrowserLayoutEffect";

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
  readonly areas: readonly RefObject<HTMLElement | null>[];
}): void {
  const latestRef = useRef({ close, areas });
  useBrowserLayoutEffect(() => {
    latestRef.current = { close, areas };
  });

  useEffect(() => {
    if (!open) return;
    const outside = (target: EventTarget | null) =>
      target instanceof Node &&
      !latestRef.current.areas.some(area => area.current?.contains(target));
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      latestRef.current.close(true);
    };
    const onOutside = (event: Event) => {
      if (outside(event.target)) latestRef.current.close(false);
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
  const shownAtRef = useRef(key);
  useEffect(() => {
    if (open && key !== shownAtRef.current) latestRef.current.close(false);
    shownAtRef.current = key;
  }, [open, key]);
}
