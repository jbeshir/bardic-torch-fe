import { useEffect, useRef } from "react";

/**
 * Where focus goes after a list changes in place (WCAG 2.4.3): a letter, a
 * page number, "Previous" or a chip is replaced or removed by the new list
 * it asked for, and the same page (same path, so the shell leaves focus
 * alone) would otherwise leave focus on `<body>`. When `key` (the list's
 * canonical query) changes and focus was lost, it moves to the results
 * heading this returns a ref for (`tabIndex={-1}`), which a screen reader
 * then reads. Focus the change kept (a filter's control, the Next link) is
 * left where it is; so is the first render.
 */
export function useResultsFocus(key: string) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousRef = useRef(key);
  useEffect(() => {
    if (previousRef.current === key) return;
    previousRef.current = key;
    const focused = document.activeElement;
    if (focused === null || focused === document.body) {
      headingRef.current?.focus({ preventScroll: true });
    }
  }, [key]);
  return headingRef;
}
