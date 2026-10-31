import type { MetaFunction } from "@remix-run/cloudflare";
import { Tabs } from "~/components/ui/Tabs";
import { Gallery, SPECIMENS } from "~/styleguide/Gallery";

/**
 * The component library in every state (DESIGN §10.6). Development,
 * preview and e2e builds only: vite.config.ts leaves this route out of
 * production builds, and check:prod-build verifies that. Not linked from
 * anywhere and not indexed.
 */

export const meta: MetaFunction = () => [
  { title: "Styleguide · Bardic Torch" },
  { name: "robots", content: "noindex, nofollow" },
];

/** A panel that forces a theme on everything inside it (DESIGN §2.1). */
function Forced({
  theme,
  anchorPrefix,
}: {
  theme: "light" | "dark";
  anchorPrefix: string;
}) {
  return (
    <div
      data-theme={theme}
      data-preview={theme}
      className="rounded-xl border border-border bg-canvas p-4 text-fg md:p-6"
    >
      <Gallery anchorPrefix={anchorPrefix} />
    </div>
  );
}

export default function Styleguide() {
  return (
    <>
      <div className="border-b border-border pb-6">
        <h1 className="text-h1 text-fg">Styleguide</h1>
        <p className="mt-2 max-w-prose text-body-lg text-fg-muted">
          Every component in every state, following docs/DESIGN.md. Not part of
          production builds.
        </p>
        <nav aria-label="Styleguide contents" className="mt-6">
          <ul role="list" className="flex flex-wrap gap-x-4 gap-y-2">
            {SPECIMENS.map(({ id, title }) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="inline-flex min-h-6 items-center rounded-sm text-body-sm font-medium text-link no-underline hover:text-link-hover hover:underline"
                >
                  {title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="mt-8">
        <Tabs
          label="Preview"
          headingLevel={2}
          // Each panel is a whole gallery: keep only the one being viewed.
          lazy
          panels={[
            { label: "Current", content: <Gallery /> },
            {
              label: "Light",
              content: <Forced theme="light" anchorPrefix="light-" />,
            },
            {
              label: "Dark",
              content: <Forced theme="dark" anchorPrefix="dark-" />,
            },
            {
              label: "Side by side",
              content: (
                <div className="grid gap-6 xl:grid-cols-2">
                  <Forced theme="light" anchorPrefix="both-light-" />
                  <Forced theme="dark" anchorPrefix="both-dark-" />
                </div>
              ),
            },
          ]}
        />
      </div>
    </>
  );
}
