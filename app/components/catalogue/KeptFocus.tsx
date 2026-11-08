import { useEffect, useRef, type ReactNode, type RefObject } from "react";

/** A control's identity across a remount: its name and value. */
function controlKey(target: EventTarget | null): string | null {
  if (target instanceof HTMLInputElement) {
    return `${target.name}=${target.value}`;
  }
  if (target instanceof HTMLSelectElement) return `select:${target.name}`;
  if (target instanceof HTMLButtonElement) {
    return `button:${target.textContent}`;
  }
  return null;
}

/**
 * Keeps the focused control focused across the remount a change of URL
 * causes (WCAG 2.4.3). A filter form is mounted with the canonical query
 * as its key, so it is rebuilt from the new state and an unapplied tick
 * can't linger; that would destroy the box, select or button the reader
 * just used and leave focus on `<body>`. Its caller keys this wrapper
 * instead, around the form: the control focused last is remembered in
 * `focusRef`, which the caller holds (so it outlives the form), and
 * refocused after the remount if focus was lost with the old form,
 * opening the disclosure around it if that came back closed. Focus that
 * moves out of the wrapper (to a letter, a page link or a chip) forgets
 * it, so a later remount never pulls focus back here.
 *
 * It adds no box of its own (`display: contents`).
 */
export function KeptFocus({
  focusRef,
  children,
}: {
  /** Where the last focused control is remembered: a ref the caller holds. */
  readonly focusRef: RefObject<string | null>;
  readonly children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    const wanted = focusRef.current;
    if (!root || wanted === null) return;
    const focused = document.activeElement;
    if (focused !== null && focused !== document.body) return;
    for (const control of root.querySelectorAll<HTMLElement>(
      "input, select, button"
    )) {
      if (controlKey(control) === wanted) {
        const details = control.closest("details");
        if (details && !details.open) details.open = true;
        control.focus();
        return;
      }
    }
  }, [focusRef]);
  return (
    <div
      ref={ref}
      className="contents"
      onFocus={event => {
        focusRef.current = controlKey(event.target);
      }}
      onBlur={event => {
        // Focus going nowhere (the control removed by the remount) keeps
        // it; focus going elsewhere on the page forgets it.
        const next = event.relatedTarget;
        if (next instanceof Node && !event.currentTarget.contains(next)) {
          focusRef.current = null;
        }
      }}
    >
      {children}
    </div>
  );
}
