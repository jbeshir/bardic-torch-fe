/**
 * Scrolls `container` (and nothing else: not the page) just enough to show
 * the element in it marked `aria-current="page"`, with `margin` px to
 * spare, keeping it above the last `endInset` px of the container (where
 * a "more below" fade lies). Does nothing when there is no such element or
 * nothing to scroll. Used by the sidebar and the navigation drawer.
 */
export function showCurrentPage(
  container: HTMLElement,
  {
    endInset = 0,
    margin = 16,
  }: { readonly endInset?: number; readonly margin?: number } = {}
): void {
  const current = container.querySelector<HTMLElement>('[aria-current="page"]');
  if (!current || container.scrollHeight <= container.clientHeight) return;
  const top =
    current.getBoundingClientRect().top -
    container.getBoundingClientRect().top +
    container.scrollTop;
  const bottom = top + current.offsetHeight;
  const visibleBottom = container.scrollTop + container.clientHeight - endInset;
  if (top < container.scrollTop) {
    container.scrollTop = top - margin;
  } else if (bottom > visibleBottom) {
    container.scrollTop = bottom - container.clientHeight + endInset + margin;
  }
}
