import { render, screen, within } from "@testing-library/react";
import { IconLock } from "@tabler/icons-react";
import { describe, expect, it } from "vitest";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { Alert, AlertRegion, TONE_GLYPHS, type AlertTone } from "./Alert";

const TONES: readonly [AlertTone, string][] = [
  ["info", "Information"],
  ["success", "Success"],
  ["warning", "Warning"],
  ["danger", "Error"],
  ["pending", "Pending approval"],
];

describe("Alert", () => {
  it.each(TONES)(
    "styles the %s tone from its status tokens and names it for screen readers",
    (tone, name) => {
      const { container } = render(
        <Alert tone={tone} title="Display name saved">
          It now shows on your edits.
        </Alert>
      );
      const box = container.firstElementChild as HTMLElement;
      expect(box).toHaveClass(
        `bg-${tone}-bg`,
        `border-${tone}-border`,
        `text-${tone}-fg`,
        "rounded-lg",
        "border"
      );
      expect(box.querySelector("svg")).toHaveClass(`text-${tone}-icon`);
      expect(box.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
      expect(box).toHaveTextContent(
        `${name}: Display name savedIt now shows on your edits.`
      );
      expect(screen.getByText(`${name}:`)).toHaveClass("sr-only");
    }
  );

  it("gives every tone its own icon shape, so state never rests on colour", () => {
    const shapes = new Set(Object.values(TONE_GLYPHS));
    expect(shapes.size).toBe(TONES.length);
    const drawn = TONES.map(([tone]) => {
      const { container, unmount } = render(<Alert tone={tone}>Body</Alert>);
      const svg = container.querySelector("svg")?.outerHTML;
      unmount();
      return svg;
    });
    expect(new Set(drawn).size).toBe(TONES.length);
  });

  it("is not a live region when rendered with the page", () => {
    render(
      <Alert tone="danger" title="We couldn’t save your changes">
        Check your connection and try again.
      </Alert>
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("puts the tone name before the body when there is no title", () => {
    render(<Alert tone="warning">This link may be broken.</Alert>);
    expect(screen.getByText(/This link may be broken/)).toHaveTextContent(
      "Warning: This link may be broken."
    );
  });

  it("can head a section with its title", () => {
    render(
      <Alert tone="info" title="This page is a stub" headingLevel={2}>
        Help fill it in.
      </Alert>
    );
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Information: This page is a stub",
      })
    ).toBeInTheDocument();
  });

  it("shows actions under the body", () => {
    render(
      <Alert
        tone="danger"
        title="We couldn’t load your profile"
        actions={<button type="button">Try again</button>}
      >
        Try again in a moment.
      </Alert>
    );
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
  });

  it("takes a replacement icon", () => {
    const { container } = render(
      <Alert tone="warning" icon={IconLock} title="Restricted">
        Ask before performing this piece.
      </Alert>
    );
    expect(container.querySelector("svg")).toHaveClass("tabler-icon-lock");
  });

  it("as a banner, is full-bleed below md and rounded from md", () => {
    const { container } = render(
      <Alert tone="pending" banner title="Waiting for approval">
        A moderator will look at it soon.
      </Alert>
    );
    expect(container.firstElementChild).toHaveClass(
      "rounded-none",
      "border-x-0",
      "md:rounded-lg",
      "md:border-x"
    );
  });

  it("renders the same token classes in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      render(
        <>
          {TONES.map(([tone]) => (
            <Alert key={tone} tone={tone} title="Title">
              Body
            </Alert>
          ))}
        </>
      )
    );
  });
});

describe("AlertRegion", () => {
  it("is mounted empty, so an alert added later is announced politely", () => {
    const { rerender } = render(<AlertRegion />);
    const region = screen.getByRole("status");
    expect(region).toBeEmptyDOMElement();
    rerender(
      <AlertRegion>
        <Alert tone="success" title="Display name saved" />
      </AlertRegion>
    );
    expect(within(region).getByText("Display name saved")).toBeVisible();
  });

  it("announces at once when urgent", () => {
    render(<AlertRegion urgent />);
    expect(screen.getByRole("alert")).toBeEmptyDOMElement();
    expect(screen.queryByRole("status")).toBeNull();
  });
});
