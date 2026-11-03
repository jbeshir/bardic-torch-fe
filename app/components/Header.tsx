import { Link as RouterLink } from "react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { SearchBox } from "./SearchBox";
import { ThemeToggle } from "./ThemeToggle";
import { Wordmark } from "./Wordmark";

/**
 * True once the page has scrolled more than 8 px: a sentinel at the top of
 * the page leaves the viewport. Without IntersectionObserver (or JS) it
 * stays false and the header simply has no shadow. One callback can carry
 * several observations, oldest first (a jump away from the top right after
 * the initial one), so the newest decides.
 */
function useScrolled() {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const element = sentinelRef.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(entries => {
      const latest = entries.at(-1);
      setScrolled(latest ? !latest.isIntersecting : false);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { sentinel: sentinelRef, scrolled };
}

/**
 * The site header (DESIGN §5.2), sticky at the top. From md it holds the
 * Menu control (md–lg), the home link, the wiki search, the theme toggle
 * and the account control. Below md only the home link is up here; the
 * rest lives in `bottomBar`, which is part of this banner in the DOM but
 * fixed to the bottom of the viewport.
 */
export function Header({
  menu,
  account,
  bottomBar,
}: {
  /** The md–lg Menu control (the drawer's trigger). */
  readonly menu: ReactNode;
  /** The account control from md. */
  readonly account: ReactNode;
  /** The bottom app bar, below md. */
  readonly bottomBar: ReactNode;
}) {
  const { sentinel, scrolled } = useScrolled();
  return (
    <>
      <div
        ref={sentinel}
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 h-2 w-px"
      />
      <header
        className={`sticky top-0 z-header h-header border-b border-border bg-canvas transition-shadow ${scrolled ? "shadow-1" : "shadow-none"}`}
      >
        {/* The border is inside --header-h, which the sticky sidebar, the
            scroll padding and the toasts all measure from. */}
        <div className="mx-auto flex h-full max-w-shell items-center gap-3 px-4 md:px-6 lg:gap-8 xl:gap-10 xl:px-8">
          <div className="flex shrink-0 items-center gap-1 lg:w-60 xl:w-64">
            <div className="hidden md:block lg:hidden">{menu}</div>
            <RouterLink
              to="/"
              prefetch="intent"
              className="group inline-flex min-h-11 items-center rounded-md px-1"
            >
              <Wordmark flicker />
            </RouterLink>
          </div>
          <div className="hidden min-w-0 max-w-md flex-1 md:block">
            <SearchBox size="md" />
          </div>
          <div className="ml-auto hidden items-center gap-3 md:flex">
            <ThemeToggle placement="header" />
            {account}
          </div>
        </div>
        {bottomBar}
      </header>
    </>
  );
}
