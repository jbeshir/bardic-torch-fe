import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { routeArgs } from "~/test/context";
import { serveFixtureApi } from "~/test/msw";
import { renderRoutes } from "~/test/router";
import PiecesRoute, { ErrorBoundary, loader } from "./pieces._index";

// The real /pieces form against the real loader (the fixture API through
// msw): what the form sends without JS, in DOM order, is answered 200 or by
// one 301 to a URL answered 200 (its blank fields are dropped there), and
// with JS it goes to the canonical URL in one request.

const fixtures = serveFixtureApi();

/** The loader's answer for `/pieces{search}`: a thrown Response is returned. */
async function answer(search: string): Promise<unknown> {
  try {
    return await loader(
      routeArgs(new Request(`https://app.test/pieces${search}`), {
        pattern: "/pieces",
      })
    );
  } catch (thrown) {
    return thrown;
  }
}

/** /pieces{search} rendered from the real loader. */
function renderPage(search: string) {
  return renderRoutes(
    [
      {
        path: "/pieces",
        loader: ({ request }) =>
          loader(routeArgs(request, { pattern: "/pieces" })),
        Component: PiecesRoute,
        ErrorBoundary,
        HydrateFallback: () => null,
      },
    ],
    `/pieces${search}`
  );
}

/**
 * The query the facet form sends without JS: its fields in DOM order. The
 * page is rendered with JS (jsdom) and narrow, so the form is the drawer's;
 * it has the same fields as the column the server renders.
 */
function nativeSubmission(): string {
  const form = screen.getByRole("dialog").querySelector("form");
  if (!form) throw new Error("no facet form");
  const params = new URLSearchParams();
  for (const [name, value] of new FormData(form)) {
    if (typeof value === "string") params.append(name, value);
  }
  return `?${params}`;
}

describe("/pieces: the facet form's own GET", () => {
  it.each([
    ["nothing set", ""],
    ["a letter", "?letter=T"],
    ["a search", "?q=kettle"],
    ["a search in title order", "?q=lament&sort=title"],
    ["a kind", "?kind=poem"],
    ["two kinds and a status", "?kind=song&kind=poem&status=endangered"],
    ["a category and a kind", "?term=eerie&kind=poem"],
    ["stubs only", "?stub=true"],
    ["hiding stubs, with a letter", "?stub=false&letter=W"],
    ["every filter", "?q=song&term=warlike&kind=song&stub=false&letter=S"],
  ])("is answered 200, after at most one 301, for %s", async (_why, search) => {
    await renderPage(search);
    await userEvent.click(screen.getByRole("button", { name: /^Filters/ }));
    const sent = nativeSubmission();
    let result = await answer(sent);
    if (result instanceof Response) {
      expect(result.status, `GET /pieces${sent}`).toBe(301);
      const target = result.headers.get("Location") ?? "";
      result = await answer(target.slice("/pieces".length));
    }
    expect(result, `GET /pieces${sent}`).not.toBeInstanceOf(Response);
  });

  it("is answered 200 after ticking more boxes too", async () => {
    const user = userEvent.setup();
    await renderPage("?letter=W");
    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.click(screen.getByRole("checkbox", { name: /^Song/ }));
    await user.click(screen.getByRole("radio", { name: "Hide stubs" }));
    const sent = nativeSubmission();
    expect(sent).toContain("stub=false");
    expect(await answer(sent)).not.toBeInstanceOf(Response);
  });

  it("goes with JS straight to the canonical URL, one request", async () => {
    const user = userEvent.setup();
    const seen: string[] = [];
    fixtures.server.events.on("request:start", ({ request }) => {
      const url = new URL(request.url);
      if (url.pathname === "/v1/pieces") seen.push(url.search);
    });
    const router = await renderPage("?letter=W");
    seen.length = 0;
    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.click(screen.getByRole("checkbox", { name: /^Poem/ }));
    await user.click(screen.getByRole("button", { name: "Show results" }));
    expect(router.state.location.search).toBe("?kind=poem&letter=W");
    expect(seen).toHaveLength(1);
  });
});
