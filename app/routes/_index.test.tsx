import { json } from "@remix-run/cloudflare";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, it, expect } from "vitest";
import Index from "./_index";

function renderHome() {
  const router = createMemoryRouter([
    {
      id: "root",
      path: "/",
      loader: () => json({ theme: null }),
      element: <Index />,
    },
  ]);
  render(<RouterProvider router={router} />);
}

describe.each(["light", "dark"])("Index route (%s)", theme => {
  it("renders the site name as the page heading and the theme choice", async () => {
    document.documentElement.dataset.theme = theme;
    renderHome();
    expect(
      await screen.findByRole("heading", { level: 1, name: "Bardic Torch" })
    ).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Theme" })).toBeInTheDocument();
    document.documentElement.removeAttribute("data-theme");
  });
});

describe("Index route", () => {
  it("runs in the jsdom environment", () => {
    expect(typeof document).toBe("object");
  });
});
