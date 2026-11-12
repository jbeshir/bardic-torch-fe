import { http } from "msw";
import { createRequestHandler } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  API_BASE_URL,
  APP_ORIGIN,
  formRequest,
  loadContext,
  routeArgs,
  sessionCookie,
  sessionTokens,
} from "~/test/context";
import { contractResponse } from "~/test/contract";
import { serveFixtureApi } from "~/test/msw";
import { runAction } from "~/test/proxy";
import { testBuild } from "~/test/server-build";
import * as contributions from "~/routes/contributions";
import * as eventEdit from "~/routes/events.$slug.edit";
import * as eventNew from "~/routes/events.new";
import * as pieceLayout from "~/routes/pieces.$slug";
import * as pieceEdit from "~/routes/pieces.$slug.edit";

// The editor loader and action through the real server entry and root,
// against the fixture API: documents posted as a browser without
// JavaScript posts them, and the pages it gets back.

const fixtures = serveFixtureApi();

const handle = createRequestHandler(
  testBuild([
    {
      id: "routes/events.$slug.edit",
      path: "events/:slug/edit",
      module: eventEdit,
      hasLoader: true,
    },
    {
      id: "routes/contributions",
      path: "contributions",
      module: contributions,
      hasLoader: true,
    },
    {
      id: "routes/events.new",
      path: "events/new",
      module: eventNew,
      hasLoader: true,
    },
    {
      id: "routes/pieces.$slug",
      path: "pieces/:slug",
      module: pieceLayout,
      hasLoader: true,
    },
    {
      id: "routes/pieces.$slug.edit",
      parentId: "routes/pieces.$slug",
      path: "edit",
      module: pieceEdit,
      hasLoader: true,
    },
  ]),
  "production"
);

afterEach(() => {
  vi.restoreAllMocks();
});

const signedIn = () =>
  sessionCookie(sessionTokens({ accessToken: "fixture:contributor" }));

/** A document POST of `form` to `path`, signed in, and the page it gets. */
async function post(path: string, form: Readonly<Record<string, string>>) {
  const request = formRequest({
    method: "POST",
    path,
    form,
    headers: { Cookie: await signedIn() },
  });
  return handle(request, loadContext());
}

const REVEL = {
  schema_version: "1",
  base_revision_id: "1013",
  name: "Midwinter Revel",
  kind: "event",
  description_md: "A winter feast.",
  summary: "Shortened the description",
  intent: "submit",
};

describe("the editor action", () => {
  it("refuses a cross-origin post with 403 before reading it", async () => {
    const request = formRequest({
      method: "POST",
      path: "/events/midwinter-revel/edit",
      form: REVEL,
      headers: { Origin: "https://elsewhere.example" },
    });
    const response = await runAction(eventEdit.action, request, {
      slug: "midwinter-revel",
    });
    expect(response.status).toBe(403);
    expect(request.bodyUsed).toBe(false);
  });

  it("submits an event's edit and goes to the contributions with a 303", async () => {
    const response = await post("/events/midwinter-revel/edit", REVEL);
    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe(
      "/contributions?submitted=2001"
    );
  });

  it("shows a 422's problems in the summary and at the field", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await post("/events/midwinter-revel/edit", {
      ...REVEL,
      name: " ",
    });
    expect(response.status).toBe(422);
    const html = await response.text();
    expect(html).toContain("Check 1 thing below");
    expect(html).toMatch(
      /href="#name"[^>]*>Name: This is needed\. Fill it in\./
    );
    expect(html).toMatch(
      /id="name-error"[^>]*>.*This is needed\. Fill it in\./s
    );
  });

  it("shows a new event's possible duplicates, and submits once acknowledged", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fields = {
      schema_version: "1",
      name: "midwinter revel ",
      kind: "event",
      intent: "submit",
    };
    const warned = await post("/events/new", fields);
    expect(warned.status).toBe(409);
    const html = await warned.text();
    expect(html).toContain('href="/events/midwinter-revel"');
    expect(html).toContain('name="acknowledge_duplicates"');

    const acknowledged = await post("/events/new", {
      ...fields,
      acknowledge_duplicates: "on",
    });
    expect(acknowledged.status).toBe(303);
  });
});

describe("the piece editor", () => {
  it("adds a credit row and keeps the earlier rows' values", async () => {
    const response = await post("/pieces/the-copper-kettle/edit", {
      schema_version: "1",
      title: "The Copper Kettle",
      "credits.0.person_slug": "wren-of-the-vale",
      "credits.0.role": "tune",
      "credits.0.note": "The second tune",
      intent: "add:credits",
    });
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toMatch(
      /name="credits\.0\.person_slug".*?<option value="wren-of-the-vale" selected="">/s
    );
    expect(html).toMatch(
      /name="credits\.0\.role".*?<option value="tune" selected="">/s
    );
    expect(html).toMatch(/name="credits\.0\.note" value="The second tune"/);
    expect(html).toContain('name="credits.1.role"');
    expect(html).not.toContain('name="credits.2.role"');
  });
});

describe("the editor loader", () => {
  it("sends a signed-out reader to log in and back", async () => {
    const response = await handle(
      new Request(`${APP_ORIGIN}/events/midwinter-revel/edit`),
      loadContext()
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(
      "/auth/login?returnTo=%2Fevents%2Fmidwinter-revel%2Fedit"
    );
  });
});

describe("the editor loader's revert", () => {
  const edit = async (path: string) =>
    (
      await handle(
        new Request(`${APP_ORIGIN}${path}`, {
          headers: { Cookie: await signedIn() },
        }),
        loadContext()
      )
    ).text();

  const notes = (html: string) =>
    /<textarea[^>]*name="version_notes_md"[^>]*>([^<]*)</.exec(html)?.[1];

  it("fills the editor from the revision's snapshot, with its summary", async () => {
    const plain = await edit("/pieces/the-copper-kettle/edit");
    expect(notes(plain)).toBe("This version has a slower chorus.");
    expect(plain).not.toContain("Revert to revision");

    // Revision 1003 had no version notes.
    const html = await edit("/pieces/the-copper-kettle/edit?revert=1003");
    expect(notes(html)).toBe("");
    expect(html).toMatch(/name="summary"[^>]*value="Revert to revision 1003"/);
  });

  it("is a notice and the plain editor for another entity's revision", async () => {
    const html = await edit("/events/midwinter-revel/edit?revert=1003");
    expect(html).toContain("different page");
    expect(html).toContain('name="name"');
  });
});

describe("the pending banner", () => {
  const pending = (slug: string) =>
    contractResponse("listMyRevisions", 200, {
      data: [
        {
          id: 51,
          entity_type: "piece",
          entity: { slug, collection_id: null, name: "A piece" },
          status: "pending",
          summary: "",
          created_at: "2026-10-01T09:00:00Z",
          review_note: null,
          reviewed_at: null,
          is_stale: false,
          author: null,
        },
      ],
      total: 1,
    });
  const layout = async (cookie: string | null) =>
    pieceLayout.loader(
      routeArgs(
        new Request(`${APP_ORIGIN}/pieces/the-copper-kettle`, {
          headers: cookie ? { Cookie: cookie } : {},
        }),
        { params: { slug: "the-copper-kettle" } }
      )
    );

  it("is set for a signed-in author with a pending revision of the piece", async () => {
    fixtures.server.use(
      http.get(`${API_BASE_URL}/v1/me/revisions`, () =>
        pending("the-copper-kettle")
      )
    );
    expect(await layout(await signedIn())).toHaveProperty("pending", true);
  });

  it("is not set for another piece's revision, a failed lookup or a signed-out reader", async () => {
    fixtures.server.use(
      http.get(`${API_BASE_URL}/v1/me/revisions`, () => pending("other"))
    );
    expect(await layout(await signedIn())).toHaveProperty("pending", false);
    fixtures.server.use(
      http.get(
        `${API_BASE_URL}/v1/me/revisions`,
        () => new Response("down", { status: 503 })
      )
    );
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await layout(await signedIn())).toHaveProperty("pending", false);
    expect(await layout(null)).toHaveProperty("pending", false);
  });
});

describe("withdrawing a contribution", () => {
  it("withdraws the pending revision and goes back with a notice", async () => {
    await post("/events/midwinter-revel/edit", REVEL);
    const response = await post("/contributions", {
      intent: "withdraw",
      revision_id: "2001",
    });
    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe(
      "/contributions?withdrawn=2001"
    );
    const page = await handle(
      new Request(`${APP_ORIGIN}/contributions?withdrawn=2001`, {
        headers: { Cookie: await signedIn() },
      }),
      loadContext()
    );
    const html = await page.text();
    expect(html).toContain("Your edit has been withdrawn.");
    expect(html).toContain("Withdrawn");
    expect(html).not.toContain('value="withdraw"');
  });

  it("says so when the revision is no longer pending", async () => {
    await post("/events/midwinter-revel/edit", REVEL);
    const form = { intent: "withdraw", revision_id: "2001" };
    await post("/contributions", form);
    const response = await post("/contributions", form);
    expect(response.status).toBe(409);
    expect(await response.text()).toContain("no longer waiting for review");
  });
});
