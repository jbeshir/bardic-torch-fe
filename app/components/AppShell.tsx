import { useLocation } from "@remix-run/react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { showCurrentPage } from "~/client/scroll-within";
import { Drawer } from "~/components/ui/Drawer";
import type { Account } from "~/constants/account";
import { useBrowserLayoutEffect } from "~/hooks/useBrowserLayoutEffect";
import { useHydrated } from "~/hooks/useHydrated";
import { AccountMenu } from "./AccountMenu";
import { BottomBar, MenuControl } from "./BottomBar";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { NavigationProgress, useSlowNavigation } from "./NavigationProgress";
import { SearchBox } from "./SearchBox";
import { Sidebar } from "./Sidebar";
import { ThemeToggle } from "./ThemeToggle";

const SITE_NAV_ID = "site-nav";

/** The height of the sidebar's "more below" fade (`h-6`). */
const SIDEBAR_FADE_PX = 24;

/**
 * The persistent sidebar scrolls on its own when it is taller than the
 * window (a laptop's 800 px): on each page it brings the current item into
 * view clear of the fade, scrolling only itself, and `more` says whether
 * anything is still below its fold (shown as a fade at its foot).
 */
function useSidebarScroll(nav: RefObject<HTMLElement>, pathname: string) {
  const [more, setMore] = useState(false);

  useEffect(() => {
    const element = nav.current;
    if (!element) return;
    const update = () =>
      setMore(
        element.scrollTop + element.clientHeight < element.scrollHeight - 1
      );
    update();
    element.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      element.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [nav]);

  useEffect(() => {
    // Anything below the current item is more below: keep it above the fade.
    if (nav.current) {
      showCurrentPage(nav.current, { endInset: SIDEBAR_FADE_PX });
    }
  }, [nav, pathname]);

  return more;
}

/**
 * After a client navigation to another page (not a hash jump, not a reload
 * of the same page's data), focus moves to the main content, as a page load
 * would leave it at the start, and the new page's title is announced. The
 * first render (the document load) is left alone, and so is a new page
 * that put focus inside the main content itself (an error page focuses its
 * heading).
 */
function useNavigationFocus(main: RefObject<HTMLElement>, pathname: string) {
  const previousRef = useRef(pathname);
  const focusedBeforeRef = useRef<Element | null>(null);
  const [announcement, setAnnouncement] = useState("");

  // Layout effects run before any page's own (passive) focus effect, so
  // this is what had focus when the new page was committed.
  useBrowserLayoutEffect(() => {
    focusedBeforeRef.current = document.activeElement;
  }, [pathname]);

  useEffect(() => {
    if (previousRef.current === pathname) return;
    previousRef.current = pathname;
    // After this render's own focus moves (a closing drawer gives focus
    // back to its trigger, an error page focuses its heading) and the new
    // <title>.
    const frame = requestAnimationFrame(() => {
      const focused = document.activeElement;
      const pageMovedFocus =
        focused !== focusedBeforeRef.current &&
        focused !== null &&
        focused !== main.current &&
        main.current?.contains(focused) === true;
      if (!pageMovedFocus) main.current?.focus({ preventScroll: true });
      setAnnouncement(document.title);
    });
    return () => cancelAnimationFrame(frame);
  }, [main, pathname]);

  return announcement;
}

/**
 * The layout every page shares (DESIGN §5): skip link, progress bar,
 * header (with the bottom app bar below md), the main sheet, the site
 * navigation, the footer and the navigation drawer.
 *
 * The site nav is one element after `</main>` (so it isn't part of the
 * skip link's target), placed by CSS: the persistent left sidebar from lg.
 * Below lg it is the site menu without JS, which the Menu and Search
 * controls jump to; once hydrated it is hidden there, and Menu opens the
 * same navigation in the drawer instead.
 *
 * The shell is at least the window's height, so a short page's footer sits
 * at the bottom; from lg the main sheet is only as tall as its content.
 */
export function AppShell({
  account,
  children,
}: {
  readonly account: Account;
  readonly children: ReactNode;
}) {
  const busy = useSlowNavigation();
  const hydrated = useHydrated();
  const { pathname } = useLocation();
  const siteNavRef = useRef<HTMLElement>(null);
  const moreBelow = useSidebarScroll(siteNavRef, pathname);
  const mainRef = useRef<HTMLElement>(null);
  const announcement = useNavigationFocus(mainRef, pathname);
  const drawerId = useId();
  const [menuOpen, setMenuOpen] = useState(false);
  const openMenu = useCallback(() => setMenuOpen(true), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  return (
    <div className="relative flex min-h-dvh flex-col max-md:pb-app-bar">
      <a
        href="#content"
        className="sr-only z-progress rounded-md bg-accent text-body-sm font-medium text-accent-fg shadow-2 focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <NavigationProgress visible={busy} />
      <p role="status" className="sr-only">
        {announcement}
      </p>
      <Header
        menu={
          <MenuControl
            look="icon"
            hydrated={hydrated}
            drawerId={drawerId}
            siteNavId={SITE_NAV_ID}
            onOpen={openMenu}
          />
        }
        account={<AccountMenu account={account} placement="header" />}
        bottomBar={
          <BottomBar
            account={account}
            hydrated={hydrated}
            drawerId={drawerId}
            siteNavId={SITE_NAV_ID}
            onOpenMenu={openMenu}
          />
        }
      />
      <div className="mx-auto flex w-full max-w-shell flex-1 flex-col lg:grid lg:grid-cols-shell lg:grid-rows-shell lg:gap-x-8 lg:px-6 xl:grid-cols-shell-xl xl:gap-x-10 xl:px-8">
        <main
          ref={mainRef}
          id="content"
          tabIndex={-1}
          aria-busy={busy || undefined}
          className="min-w-0 flex-1 bg-surface px-4 py-6 focus-visible:outline-none md:p-6 lg:col-start-2 lg:row-start-1 lg:mb-10 lg:mt-6 lg:self-start lg:rounded-xl lg:border lg:border-border lg:p-8 lg:shadow-1 xl:p-10"
        >
          {children}
        </main>
        <nav
          ref={siteNavRef}
          id={SITE_NAV_ID}
          aria-label="Site"
          className={`${hydrated ? "hidden lg:block" : ""} border-t border-border px-4 pt-8 md:px-6 lg:sticky lg:top-header lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:max-h-below-header lg:self-start lg:overflow-y-auto lg:border-t-0 lg:px-0 lg:pr-4 lg:pt-6 xl:pr-6`}
        >
          {/* The end space is inside this wrapper, not the scroller's
              padding: a sticky element stops at the padding edge, so the
              fade below meets the sidebar's visible foot. */}
          <div className="pb-8">
            {/* The heading stays for screen readers at lg, so the sidebar's
              group headings (h3) sit under an h2 there too. */}
            <h2 className="pb-4 text-h3 text-fg lg:sr-only">Site menu</h2>
            <div className="space-y-4 pb-6 md:hidden">
              <SearchBox size="lg" />
              <ThemeToggle placement="drawer" />
            </div>
            <Sidebar />
          </div>
          <div
            aria-hidden="true"
            data-testid="sidebar-more"
            className={`pointer-events-none sticky bottom-0 -mt-6 hidden h-6 bg-gradient-to-t from-canvas ${moreBelow ? "lg:block" : ""}`}
          />
        </nav>
        <div className="lg:col-start-2 lg:row-start-2">
          <Footer />
        </div>
      </div>
      <Drawer
        id={drawerId}
        open={menuOpen}
        onClose={closeMenu}
        title="Site menu"
        closeFrom="lg"
        footer={
          // From md the header has the theme toggle: one per page (§6.24).
          <div className="md:hidden">
            <ThemeToggle placement="drawer" />
          </div>
        }
      >
        <div className="space-y-6">
          <SearchBox size="lg" />
          <nav aria-label="Site">
            <Sidebar />
          </nav>
        </div>
      </Drawer>
    </div>
  );
}
