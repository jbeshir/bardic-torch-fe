import { createRequestHandler } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { APP_ORIGIN, formRequest, loadContext } from "~/test/context";
import { serveFixtureApi } from "~/test/msw";
import { testBuild } from "~/test/server-build";
import * as contact from "./contact";

// The contact form's loaders and actions through
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
  testBuild([route("contact", "contact", contact)]),
  "production"
);

afterEach(() => {
  vi.restoreAllMocks();
});

async function get(path: string) {
  return handle(new Request(`${APP_ORIGIN}${path}`), loadContext());
}

async function post(path: string, form: Readonly<Record<string, string>>) {
  return handle(formRequest({ method: "POST", path, form }), loadContext());
}

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
});
