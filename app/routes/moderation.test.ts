import { createRequestHandler } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  APP_ORIGIN,
  formRequest,
  loadContext,
  sessionCookie,
  sessionTokens,
} from "~/test/context";
import { serveFixtureApi } from "~/test/msw";
import { testBuild } from "~/test/server-build";
import * as contact from "./contact";
import * as inbox from "./moderation.contact";
import * as queue from "./moderation._index";
import * as takedown from "./moderation.links";
import * as review from "./moderation.revisions.$id";
import * as blocking from "./moderation.users";

// The moderation pages' and the contact form's loaders and actions through
// the real server entry and root, against the fixture API, as a browser
// without JavaScript posts them.

serveFixtureApi();

const route = (id: string, path: string, module: object) => ({
  id: `routes/${id}`,
  path,
  module,
  hasLoader: true,
});

const handle = createRequestHandler(
  testBuild([
    route("moderation._index", "moderation", queue),
    route("moderation.revisions.$id", "moderation/revisions/:id", review),
    route("moderation.contact", "moderation/contact", inbox),
    route("moderation.links", "moderation/links", takedown),
    route("moderation.users", "moderation/users", blocking),
    route("contact", "contact", contact),
  ]),
  "production"
);

afterEach(() => {
  vi.restoreAllMocks();
});

const as = (user: "moderator" | "contributor") =>
  sessionCookie(sessionTokens({ accessToken: `fixture:${user}` }));

async function get(path: string, user?: "moderator" | "contributor") {
  const headers: HeadersInit = user ? { Cookie: await as(user) } : {};
  return handle(
    new Request(`${APP_ORIGIN}${path}`, { headers }),
    loadContext()
  );
}

async function post(
  path: string,
  form: Readonly<Record<string, string>>,
  user?: "moderator"
) {
  const headers = user ? { Cookie: await as(user) } : {};
  return handle(
    formRequest({ method: "POST", path, form, headers }),
    loadContext()
  );
}

describe("the moderation pages", () => {
  it("tell anyone but a moderator that they are for moderators", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await get("/moderation", "contributor");
    expect(response.status).toBe(403);
    expect(await response.text()).toContain("This page is for moderators.");
  });

  it("approve a stale revision only once its overwrite is acknowledged", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const page = await (
      await get("/moderation/revisions/1901", "moderator")
    ).text();
    expect(page).toContain("has changed since this edit was started");
    expect(page).toContain("Compared with the current version");

    const refused = await post(
      "/moderation/revisions/1901",
      { intent: "approve" },
      "moderator"
    );
    expect(refused.status).toBe(409);
    expect(await refused.text()).toContain("Approve it anyway");

    const approved = await post(
      "/moderation/revisions/1901",
      { intent: "approve", acknowledge_stale: "on" },
      "moderator"
    );
    expect(approved.status).toBe(303);
    expect(approved.headers.get("Location")).toBe("/moderation?approved=1901");
    const left = await (await get("/moderation", "moderator")).text();
    expect(left).not.toContain("Credited the tune and added links");
  });

  it("reject a revision only with a note for its author", async () => {
    const blank = await post(
      "/moderation/revisions/1902",
      { intent: "reject", note: "  " },
      "moderator"
    );
    expect(blank.status).toBe(400);
    expect(await blank.text()).toContain("Say why");

    const rejected = await post(
      "/moderation/revisions/1902",
      { intent: "reject", note: "Please cite where the feast is named so." },
      "moderator"
    );
    expect(rejected.headers.get("Location")).toBe("/moderation?rejected=1902");
  });

  it("close a contact request, which then lists as resolved", async () => {
    const closed = await post(
      "/moderation/contact",
      { request_id: "1", status: "resolved", note: "Hid the link." },
      "moderator"
    );
    expect(closed.headers.get("Location")).toBe("/moderation/contact?closed=1");
    const resolved = await (
      await get("/moderation/contact?status=resolved", "moderator")
    ).text();
    expect(resolved).toContain("Hid the link.");
  });

  it("hide a link found by its address", async () => {
    const url = "https://video.example/watch/kettle-hearth";
    const found = await (
      await get(
        `/moderation/links?${new URLSearchParams({ url })}`,
        "moderator"
      )
    ).text();
    expect(found).toContain("Shown on the site");
    const id = /name="link_id" value="(\d+)"/.exec(found)?.[1] ?? "";

    const hidden = await post(
      "/moderation/links",
      { link_id: id, hidden: "true", url },
      "moderator"
    );
    const back = hidden.headers.get("Location") ?? "";
    expect(back).toContain("done=hidden");
    expect(await (await get(back, "moderator")).text()).toContain(
      "Hidden from the site"
    );
  });

  it("say a moderator can't be blocked", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await post(
      "/moderation/users",
      { user_id: "fixture|moderator", blocked: "true" },
      "moderator"
    );
    expect(response.status).toBe(409);
    expect(await response.text()).toContain(
      "Moderators can’t be blocked or unblocked."
    );
  });
});

describe("the contact form", () => {
  const MESSAGE = {
    kind: "link_report",
    email: "reader@example.org",
    url: "https://video.example/watch/kettle-hearth",
    message: "The video has the lyrics in its description.",
    "cf-turnstile-response": "XXXX.DUMMY.TOKEN.XXXX",
  };

  it("opens as a link report from a link's Report link", async () => {
    const html = await (
      await get(
        `/contact?${new URLSearchParams({ kind: "link_report", url: MESSAGE.url })}`
      )
    ).text();
    expect(html).toContain('<option value="link_report" selected="">');
    expect(html).toContain(`value="${MESSAGE.url}"`);
  });

  it("asks for a reply address and for the robot check, in our words", async () => {
    const noEmail = await post("/contact", { ...MESSAGE, email: "nope" });
    expect(noEmail.status).toBe(400);
    expect(await noEmail.text()).toContain(
      "Enter an email address we can reply to"
    );

    const noToken = await post("/contact", {
      ...MESSAGE,
      "cf-turnstile-response": "",
    });
    expect(await noToken.text()).toContain("the check that you’re not a robot");
  });

  it("sends the request, which the inbox then lists", async () => {
    const sent = await post("/contact", MESSAGE);
    expect(sent.status).toBe(303);
    expect(sent.headers.get("Location")).toBe("/contact?sent=1");
    const listed = await (await get("/moderation/contact", "moderator")).text();
    expect(listed).toContain("The video has the lyrics in its description.");
  });
});
