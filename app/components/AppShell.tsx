import { IconMenu2 } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { NavigationProgress, useSlowNavigation } from "./NavigationProgress";
import { SearchBox } from "./SearchBox";
import { Sidebar } from "./Sidebar";
import { ThemeToggle } from "./ThemeToggle";

const SITE_NAV_ID = "site-nav";

/** The Menu control without JS: a jump to the site menu after the content. */
function MenuLink() {
  return (
    <a
      href={`#${SITE_NAV_ID}`}
      className="inline-flex h-11 w-11 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface-sunken hover:text-fg"
    >
      <IconMenu2 size={20} stroke={1.75} aria-hidden="true" />
      <span className="sr-only">Menu</span>
    </a>
  );
}

/**
 * The layout every page shares (DESIGN §5): skip link, progress bar,
 * header, the main sheet, the site navigation and the footer.
 *
 * The site nav is one element after `</main>` (so it isn't part of the
 * skip link's target), placed by CSS: the persistent left sidebar from lg,
 * and below lg the no-JS site menu that the Menu control jumps to.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const busy = useSlowNavigation();
  return (
    <div className="relative">
      <a
        href="#content"
        className="sr-only z-progress rounded-md bg-accent px-3 py-2 text-body-sm font-medium text-accent-fg shadow-2 focus:not-sr-only focus:fixed focus:left-2 focus:top-2"
      >
        Skip to content
      </a>
      <NavigationProgress visible={busy} />
      <Header menu={<MenuLink />} account={null} bottomBar={null} />
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
          className="border-t border-border px-4 py-8 md:px-6 lg:sticky lg:top-header lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:max-h-below-header lg:self-start lg:overflow-y-auto lg:border-t-0 lg:px-0 lg:pb-8 lg:pr-4 lg:pt-6 xl:pr-6"
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
    </div>
  );
}
