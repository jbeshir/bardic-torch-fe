import { useLocation } from "@remix-run/react";
import { IconX } from "@tabler/icons-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "./Button";
import { useModalDialog } from "~/hooks/useModalDialog";

/** Tailwind's `lg`, where the persistent sidebar takes over from the drawer. */
const LG_QUERY = "(min-width: 1024px)";

/**
 * The navigation drawer (DESIGN §6.21) on a native modal `<dialog>`, opened
 * nearest its trigger: a bottom sheet below md (the bottom app bar), the
 * left edge from md. A visible h2 names it; focus starts on the close
 * button and returns to the opener. The body scrolls between the title
 * row and a footer that stays in the thumb zone: `footer` (e.g. the
 * ThemeToggle) above a full-width close button. It closes on Escape, the
 * backdrop, either close button and any navigation, and, with
 * `closeFrom="lg"`, when the viewport grows to where the sidebar shows.
 */
export function Drawer({
  id,
  open,
  onClose,
  title,
  closeLabel = "Close menu",
  children,
  footer,
  closeFrom,
}: {
  /** For the trigger's `aria-controls`. */
  readonly id?: string;
  readonly open: boolean;
  /** Called for every way of closing; set `open` false in response. */
  readonly onClose: () => void;
  readonly title: string;
  readonly closeLabel?: string;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  /** Close once the viewport reaches this breakpoint. */
  readonly closeFrom?: "lg" | undefined;
}) {
  const titleId = useId();
  const close = useRef<HTMLButtonElement>(null);
  const dialog = useModalDialog({
    open,
    onClose,
    initialFocus: close,
    closeOnBackdrop: true,
  });

  const { key } = useLocation();
  const shownAt = useRef(key);
  useEffect(() => {
    if (!open) {
      shownAt.current = key;
      return;
    }
    if (key !== shownAt.current) onClose();
  }, [open, key, onClose]);

  useEffect(() => {
    if (!open || !closeFrom) return;
    const query = window.matchMedia(LG_QUERY);
    const onChange = () => {
      if (query.matches) onClose();
    };
    onChange();
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [open, closeFrom, onClose]);

  return (
    <dialog
      ref={dialog}
      id={id}
      aria-labelledby={titleId}
      className={
        // Below md: a bottom sheet. From md: the left edge, full height.
        "bottom-0 left-0 right-0 top-auto m-0 max-h-sheet w-full max-w-none flex-col overflow-hidden rounded-t-xl border-t border-border bg-surface-raised p-0 pb-safe-b text-fg shadow-3 backdrop:bg-scrim/scrim open:flex " +
        "md:right-auto md:top-0 md:h-dvh md:max-h-dvh md:w-drawer md:rounded-none md:rounded-r-xl md:border-r md:border-t-0 md:pb-0 " +
        "motion-safe:animate-sheet-in motion-reduce:animate-fade-in motion-safe:backdrop:animate-fade-in md:motion-safe:animate-drawer-in"
      }
    >
      {open ? (
        <>
          <div
            aria-hidden="true"
            className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border-strong md:hidden"
          />
          <div className="flex shrink-0 items-center justify-between gap-4 py-2 pl-4 pr-2">
            <h2 id={titleId} className="text-h3 text-fg">
              {title}
            </h2>
            <Button
              ref={close}
              variant="ghost"
              icon={IconX}
              label={closeLabel}
              onClick={onClose}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            {children}
          </div>
          <div className="shrink-0 space-y-3 border-t border-border px-4 py-3">
            {footer}
            <Button variant="secondary" fullWidth onClick={onClose}>
              {closeLabel}
            </Button>
          </div>
        </>
      ) : null}
    </dialog>
  );
}
