import { useCallback, useId, useState, type ReactNode } from "react";
import { Drawer } from "~/components/ui/Drawer";
import type { Account } from "~/constants/account";
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
 */
export function AppShell({
  account,
  children,
}: {
  account: Account;
  children: ReactNode;
}) {
  const busy = useSlowNavigation();
  const hydrated = useHydrated();
  const drawerId = useId();
  const [menuOpen, setMenuOpen] = useState(false);
  const openMenu = useCallback(() => setMenuOpen(true), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  return (
    <div className="relative max-md:pb-app-bar">
      <a
        href="#content"
        className="sr-only z-progress rounded-md bg-accent text-body-sm font-medium text-accent-fg shadow-2 focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <NavigationProgress visible={busy} />
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
      <div className="mx-auto max-w-shell lg:grid lg:grid-cols-shell lg:gap-x-8 lg:px-6 xl:grid-cols-shell-xl xl:gap-x-10 xl:px-8">
        <main
          id="content"
          tabIndex={-1}
          aria-busy={busy || undefined}
          className="min-w-0 bg-surface px-4 py-6 focus-visible:outline-none md:p-6 lg:col-start-2 lg:row-start-1 lg:mb-10 lg:mt-6 lg:rounded-xl lg:border lg:border-border lg:p-8 lg:shadow-1 xl:p-10"
        >
          {children}
        </main>
        <nav
          id={SITE_NAV_ID}
          aria-label="Site"
          className={`${hydrated ? "hidden lg:block" : ""} border-t border-border px-4 py-8 md:px-6 lg:sticky lg:top-header lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:max-h-below-header lg:self-start lg:overflow-y-auto lg:border-t-0 lg:px-0 lg:pb-8 lg:pr-4 lg:pt-6 xl:pr-6`}
        >
          <div className="space-y-4 pb-6 lg:hidden">
            <h2 className="text-h3 text-fg">Site menu</h2>
            <div className="md:hidden">
              <SearchBox size="lg" />
            </div>
            <div className="md:hidden">
              <ThemeToggle placement="drawer" />
            </div>
          </div>
          <Sidebar />
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
        footer={<ThemeToggle placement="drawer" />}
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
