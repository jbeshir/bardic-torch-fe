import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithRouter } from "~/test/router";
import { ProblemAlert } from "./ProblemAlert";

describe("ProblemAlert", () => {
  it("uses the form's fallback when the service had trouble", async () => {
    await renderWithRouter(
      <ProblemAlert
        error={{
          code: "try_again",
          message: "We couldn’t do that just now.",
        }}
        fallback="We couldn’t save your changes. Check your connection and try again."
      />
    );
    expect(
      screen.getByText(
        "We couldn’t save your changes. Check your connection and try again."
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
});
