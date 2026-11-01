import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import {
  Infobox,
  InfoboxFact,
  InfoboxFactLabel,
  InfoboxFacts,
  InfoboxFactValue,
} from "./Infobox";

function Facts() {
  return (
    <InfoboxFacts>
      <InfoboxFact>
        <InfoboxFactLabel>
          <a href="#low-risk">Low Risk</a>
        </InfoboxFactLabel>
        <InfoboxFactValue>found in at least 4 places.</InfoboxFactValue>
      </InfoboxFact>
      <InfoboxFact>
        <InfoboxFactLabel>Restricted</InfoboxFactLabel>
        <InfoboxFactValue>never shared.</InfoboxFactValue>
      </InfoboxFact>
    </InfoboxFacts>
  );
}

const SECTIONS = [
  {
    heading: "Statuses",
    rows: [
      { label: "Low risk", value: "Four or more places" },
      { label: "Endangered", value: "Exactly three places" },
      { label: "Restricted", value: null },
    ],
  },
  { heading: "Empty", rows: [] },
] as const;

describe("Infobox", () => {
  it("is an aside named by its h2 title, with h3 sections", () => {
    render(<Infobox title="At a glance" sections={SECTIONS} />);
    const aside = screen.getByRole("complementary", { name: "At a glance" });
    const title = within(aside).getByRole("heading", { level: 2 });
    expect(title).toHaveTextContent("At a glance");
    expect(title).toHaveClass("text-h3");
    const section = within(aside).getByRole("heading", { level: 3 });
    expect(section).toHaveTextContent("Statuses");
    expect(section).toHaveClass("text-label-caps", "uppercase");
  });

  it("lists facts as a definition list", () => {
    render(<Infobox title="At a glance" sections={SECTIONS} />);
    const terms = screen.getAllByRole("term");
    const definitions = screen.getAllByRole("definition");
    expect(terms.map(term => term.textContent)).toEqual([
      "Low risk",
      "Endangered",
      "Restricted",
    ]);
    expect(definitions[1]).toHaveTextContent("Exactly three places");
  });

  it("shows a dash for an empty value and says it isn't recorded", () => {
    render(<Infobox title="At a glance" sections={SECTIONS} />);
    const empty = screen.getAllByRole("definition")[2];
    expect(empty).toHaveTextContent("—Not recorded");
    expect(within(empty as HTMLElement).getByText("—")).toHaveAttribute(
      "aria-hidden",
      "true"
    );
    expect(within(empty as HTMLElement).getByText("Not recorded")).toHaveClass(
      "sr-only"
    );
  });

  it("leaves out sections with no rows", () => {
    render(<Infobox title="At a glance" sections={SECTIONS} />);
    expect(screen.queryByText("Empty")).toBeNull();
  });

  it("gives each infobox its own title id", () => {
    render(
      <>
        <Infobox title="One" sections={SECTIONS} />
        <Infobox title="Two" sections={SECTIONS} />
      </>
    );
    expect(screen.getByRole("complementary", { name: "One" })).toBeVisible();
    expect(screen.getByRole("complementary", { name: "Two" })).toBeVisible();
  });

  it("has the accent cap, floats right from md and stacks below", () => {
    render(<Infobox title="At a glance" sections={SECTIONS} />);
    expect(screen.getByRole("complementary")).toHaveClass(
      "border-t-3",
      "border-t-accent",
      "bg-surface-raised",
      "mb-6",
      "md:float-right",
      "md:w-infobox",
      "xl:w-infobox-xl"
    );
  });

  it("shows a subtitle and a footer action", () => {
    render(
      <Infobox
        title="At a glance"
        subtitle="Five statuses"
        sections={SECTIONS}
        footer={<a href="/help/contributing">Help complete this page</a>}
      />
    );
    expect(screen.getByText("Five statuses")).toHaveClass("text-fg-muted");
    expect(
      screen.getByRole("link", { name: "Help complete this page" })
    ).toBeVisible();
  });

  it("is busy with skeleton rows while loading", () => {
    render(<Infobox title="At a glance" sections={SECTIONS} loading />);
    expect(
      screen.getByText("Loading these details…").parentElement
    ).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("term")).toBeNull();
  });

  it("says when the details couldn't load, with the retry control", () => {
    render(
      <Infobox
        title="At a glance"
        sections={SECTIONS}
        error={{ retry: <button type="button">Try again</button> }}
      />
    );
    expect(screen.getByText("Couldn’t load these details.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
    expect(screen.queryByRole("term")).toBeNull();
  });

  it("takes facts outside any section as children, styled like section rows", () => {
    render(
      <Infobox title="At a glance">
        <Facts />
      </Infobox>
    );
    const aside = screen.getByRole("complementary", { name: "At a glance" });
    expect(within(aside).queryByRole("heading", { level: 3 })).toBeNull();
    const terms = within(aside).getAllByRole("term");
    expect(terms.map(term => term.textContent)).toEqual([
      "Low Risk",
      "Restricted",
    ]);
    expect(
      within(terms[0] as HTMLElement).getByRole("link", { name: "Low Risk" })
    ).toHaveAttribute("href", "#low-risk");
    expect(terms[0]).toHaveClass("text-fg-muted");
    expect(within(aside).getAllByRole("definition")[1]).toHaveClass("text-fg");
    expect(terms[0]?.parentElement).toHaveClass("sm:grid-cols-infobox");
  });

  it("hides child facts while loading or failed, like section rows", () => {
    render(
      <>
        <Infobox title="Loading" loading>
          <Facts />
        </Infobox>
        <Infobox
          title="Failed"
          error={{ retry: <button type="button">Try again</button> }}
        >
          <Facts />
        </Infobox>
      </>
    );
    expect(screen.queryByRole("term")).toBeNull();
  });

  it("renders the same token classes in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      render(
        <Infobox title="At a glance" sections={SECTIONS}>
          <Facts />
        </Infobox>
      )
    );
  });
});
