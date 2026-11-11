import { useRef, type RefObject } from "react";
import { useBrowserLayoutEffect } from "./useBrowserLayoutEffect";

/** The page can't scroll behind an open modal. */
const SCROLL_LOCK = "overflow-hidden";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), ' +
  'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableIn(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    element => element.checkVisibility?.() ?? true
  );
}

/**
 * Tab and Shift+Tab wrap around inside the dialog. A native modal already
 * makes the page inert, but Tab off its last control would still leave for
 * the browser's own UI; this keeps focus in the dialog, and also covers a
 * browser without `inert`.
 */
function trapTab(dialog: HTMLDialogElement, event: KeyboardEvent) {
  if (event.key !== "Tab") return;
  const focusable = focusableIn(dialog);
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (!first || !last) {
    event.preventDefault();
    return;
  }
  const active = document.activeElement;
  const inside = active instanceof Node && dialog.contains(active);
  if (event.shiftKey && (active === first || !inside)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || !inside)) {
    event.preventDefault();
    first.focus();
  }
}

/**
 * The behaviour Dialog and Drawer share, on a native `<dialog>` opened with
 * `showModal()` (top layer, inert page, Escape):
 * - `open` drives it; every way of closing (Escape, the backdrop, a forced
 *   close by the browser) calls `onClose`, and the parent sets `open` false.
 * - On open, focus goes to `initialFocus` (React's `autoFocus` can't do it:
 *   it fires before the dialog is shown), and the page stops scrolling.
 * - On close, focus returns to the element that had it when the dialog
 *   opened; if that is gone (a deleted row), to `fallbackFocus()`.
 * - Tab wraps around inside. Escape is ignored while `dismissible` is false
 *   (a pending submit); a backdrop click closes only with
 *   `closeOnBackdrop`.
 */
export function useModalDialog({
  open,
  onClose,
  initialFocus,
  fallbackFocus,
  dismissible = true,
  closeOnBackdrop,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly initialFocus: RefObject<HTMLElement | null>;
  readonly fallbackFocus?: (() => HTMLElement | null) | undefined;
  readonly dismissible?: boolean;
  readonly closeOnBackdrop: boolean;
}): RefObject<HTMLDialogElement | null> {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // The latest props, for listeners that live as long as the dialog is open.
  const latestRef = useRef({
    open,
    onClose,
    fallbackFocus,
    dismissible,
    closeOnBackdrop,
  });
  useBrowserLayoutEffect(() => {
    latestRef.current = {
      open,
      onClose,
      fallbackFocus,
      dismissible,
      closeOnBackdrop,
    };
  });

  // A layout effect, so the native dialog opens and closes in the same
  // commit as its content. When a result closes it and shows an alert in
  // one render, the emptied <dialog> is never left modal (or painted)
  // beside the alert, and focus is back before the next paint.
  useBrowserLayoutEffect(() => {
    const element = dialogRef.current;
    if (!open || !element) return;
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const root = document.documentElement;
    if (!element.open) element.showModal();
    root.classList.add(SCROLL_LOCK);
    initialFocus.current?.focus();

    // A click that starts and ends on the <dialog> itself (not its content)
    // is on the backdrop. Checking the press too means a text selection
    // dragged out of the content doesn't close it.
    let pressedOnBackdrop = false;
    const onPointerDown = (event: PointerEvent) => {
      pressedOnBackdrop = event.target === element;
    };
    const onClick = (event: MouseEvent) => {
      if (
        pressedOnBackdrop &&
        event.target === element &&
        latestRef.current.closeOnBackdrop &&
        latestRef.current.dismissible
      ) {
        latestRef.current.onClose();
      }
    };
    const onCancel = (event: Event) => {
      event.preventDefault();
      if (latestRef.current.dismissible) latestRef.current.onClose();
    };
    // The browser may close a modal itself (a repeated Escape); keep the
    // parent's state in step.
    const onNativeClose = () => {
      if (latestRef.current.open) latestRef.current.onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => trapTab(element, event);

    element.addEventListener("pointerdown", onPointerDown);
    element.addEventListener("click", onClick);
    element.addEventListener("cancel", onCancel);
    element.addEventListener("close", onNativeClose);
    element.addEventListener("keydown", onKeyDown);
    return () => {
      element.removeEventListener("pointerdown", onPointerDown);
      element.removeEventListener("click", onClick);
      element.removeEventListener("cancel", onCancel);
      element.removeEventListener("close", onNativeClose);
      element.removeEventListener("keydown", onKeyDown);
      root.classList.remove(SCROLL_LOCK);
      if (element.open) element.close();
      const target = opener?.isConnected
        ? opener
        : (latestRef.current.fallbackFocus?.() ?? null);
      target?.focus();
    };
  }, [open, initialFocus]);

  return dialogRef;
}
