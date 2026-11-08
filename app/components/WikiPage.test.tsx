import { screen, within } from "@testing-library/react";
import { IconBook2, IconHistory } from "@tabler/icons-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Infobox } from "~/components/ui/Infobox";
import { renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { WikiPage } from "./WikiPage";

const CONTENTS = ["One", "Two", "Three", "Four"].map(label => ({
  id: label.toLowerCase(),
  label,
}));

function renderPage(props: Partial<Parameters<typeof WikiPage>[0]> = {}) {
  return renderWithRouter(
    <WikiPage
      title="Conservation status"
      breadcrumbs={{
        trail: [{ label: "Help", to: "/help" }],
        current: "Conservation status",
      }}
      meta={
        <a href="https://example.test/source">Adapted from the original wiki</a>
      }
      infobox={
        <Infobox
          title="At a glance"
          sections={[
            {
              heading: "Statuses",
              rows: [{ label: "Low risk", value: "Four or more places" }],
            },
          ]}
        />
      }
      intro={<p>Statuses flag works that may need help.</p>}
      contents={CONTENTS}
      categories={[{ label: "Help", to: "/help" }]}
      licence="This page is available under CC BY-SA 4.0."
      {...props}
    >
      <h2 id="one">One</h2>
      <p>Body text.</p>
    </WikiPage>,
    "/help/conservation-status"
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("WikiPage", () => {
  it("puts the breadcrumbs, then the h1, then the title rule with the Read label and meta", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    await renderPage();
    const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
    const title = screen.getByRole("heading", {
      level: 1,
      name: "Conservation status",
    });
    expect(
      crumbs.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    const read = screen.getByText("Read").closest("[aria-current]");
    expect(read).toHaveAttribute("aria-current", "page");
    expect(read?.tagName).toBe("SPAN");
    expect(screen.queryByRole("navigation", { name: "Page views" })).toBeNull();
    expect(
      screen.getByRole("link", { name: "Adapted from the original wiki" })
    ).toBeInTheDocument();
  });

  it("puts the infobox first in the content, before the intro and the prose", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    await renderPage();
    const infobox = screen.getByRole("complementary", { name: "At a glance" });
    const intro = screen.getByText("Statuses flag works that may need help.");
    expect(
      infobox.compareDocumentPosition(intro) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(infobox.parentElement).toHaveClass("flow-root");
    expect(intro.parentElement).toHaveClass("prose-bt");
  });

  it("shows the contents from four h2s, after the intro", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    await renderPage();
    const contents = screen.getByRole("navigation", { name: "Contents" });
    expect(
      screen
        .getByText("Statuses flag works that may need help.")
        .compareDocumentPosition(contents) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("leaves the contents out with fewer than four h2s", async () => {
    await renderPage({ contents: CONTENTS.slice(0, 3) });
    expect(screen.queryByRole("navigation", { name: "Contents" })).toBeNull();
  });

  it("ends with the Categories chips and the licence line", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    await renderPage();
    const categories = screen.getByRole("navigation", { name: "Categories" });
    expect(
      within(categories).getByRole("link", { name: "Help" })
    ).toHaveAttribute("href", "/help");
    expect(
      screen.getByText("This page is available under CC BY-SA 4.0.")
    ).toBeInTheDocument();
  });

  it("needs only a title and content", async () => {
    await renderWithRouter(
      <WikiPage title="Help">
        <p>Index.</p>
      </WikiPage>
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Help" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.getByText("Read")).toBeInTheDocument();
  });

  it("shows the subtitle under the h1, the page's views and its banners", async () => {
    await renderPage({
      subtitle: "Topic · 2 pieces",
      views: [
        { label: "Read", to: "/help/conservation-status", icon: IconBook2 },
        {
          label: "History",
          to: "/help/conservation-status/history",
          icon: IconHistory,
        },
      ],
      banners: <p>A banner</p>,
    });
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.nextElementSibling).toHaveTextContent("Topic · 2 pieces");
    const views = screen.getByRole("navigation", { name: "Page views" });
    expect(
      within(views).getByRole("link", { name: "History" })
    ).toHaveAttribute("href", "/help/conservation-status/history");
    expect(screen.getByText("A banner")).toBeVisible();
  });

  it("looks the same in both themes", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    await expectSameMarkupInBothThemes(() => renderPage());
  });
});
