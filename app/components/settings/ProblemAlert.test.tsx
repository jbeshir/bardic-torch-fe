import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithRouter } from "~/test/router";
import { expectSameMarkupInBothThemes } from "~/test/themes";
import { ProblemAlert } from "./ProblemAlert";

describe("ProblemAlert", () => {
  it("shows the proxy's specific copy as a danger alert", async () => {
    await renderWithRouter(
      <ProblemAlert
        error={{
          code: "token_limit_reached",
          message: "You already have 10 API tokens.",
        }}
        fallback="We couldn’t create a token."
      />
    );
    expect(
      screen.getByText("You already have 10 API tokens.")
    ).toBeInTheDocument();
    expect(screen.getByText("Error:", { exact: false })).toHaveClass("sr-only");
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("uses the form's fallback when the service had trouble", async () => {
    await renderWithRouter(
      <ProblemAlert
        error={{
          code: "internal",
          message: "Bardic Torch couldn’t do that just now.",
        }}
        fallback="We couldn’t create a token. Check your connection and try again."
      />
    );
    expect(
      screen.getByText(
        "We couldn’t create a token. Check your connection and try again."
      )
    ).toBeInTheDocument();
  });

  it("offers Log in back to Settings when the session has ended", async () => {
    await renderWithRouter(
      <ProblemAlert
        error={{
          code: "unauthenticated",
          message:
            "You’ve been signed out. Log in again and we’ll bring you back here.",
        }}
        fallback="We couldn’t save your changes."
      />
    );
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute(
      "href",
      "/auth/login?returnTo=%2Fsettings"
    );
  });

  it("looks the same in both themes", async () => {
    await expectSameMarkupInBothThemes(() =>
      renderWithRouter(
        <ProblemAlert
          error={{ code: "unauthenticated", message: "Signed out." }}
          fallback="Fallback."
        />
      )
    );
  });
});
