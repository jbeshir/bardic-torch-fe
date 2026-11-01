import { describe, expect, it, vi } from "vitest";
import { SEED_USERS } from "../../test/fixture-api/data";
import { responseProblems } from "../../test/fixture-api/spec";
import {
  bearer,
  json,
  runScenario,
  SCENARIOS,
  type Send,
} from "../../test/contract/scenarios";
import { action as updateMeAction } from "~/routes/api.me";
import {
  API_BASE_URL,
  formRequest,
  sessionCookie,
  sessionTokens,
} from "./context";
import { serveFixtureApi } from "./msw";
import { runAction } from "./proxy";

const fixtureApi = serveFixtureApi();

const mswSend: Send = async request => {
  const response = await fetch(`${API_BASE_URL}${request.path}`, {
    method: request.method,
    headers: {
      ...(request.authorization
        ? { Authorization: request.authorization }
        : {}),
      ...(request.contentType ? { "Content-Type": request.contentType } : {}),
    },
    ...(request.body === undefined ? {} : { body: request.body }),
  });
  const text = await response.text();
  return {
    status: response.status,
    body: text === "" ? undefined : (JSON.parse(text) as unknown),
  };
};

describe("msw fixture handlers", () => {
  it.each(
    SCENARIOS.map(
      scenario =>
        [`${scenario.operationId} ${scenario.name}`, scenario] as const
    )
  )("%s answers as the spec says", async (_name, scenario) => {
    const response = await runScenario(scenario, mswSend);
    expect(response.status).toBe(scenario.status);
    expect(
      responseProblems(scenario.operationId, response.status, response.body)
    ).toEqual([]);
  });

  it("serve the app's own requests: a stub session's bearer reaches the fixture user", async () => {
    const response = await runAction(
      updateMeAction,
      formRequest({
        method: "PATCH",
        path: "/api/me",
        form: { display_name: "Morwen the Bold" },
        headers: {
          Cookie: await sessionCookie(
            sessionTokens({ accessToken: "fixture:contributor" })
          ),
        },
      })
    );
    expect(await response.json()).toEqual({
      ok: true,
      data: { ...SEED_USERS.contributor, display_name: "Morwen the Bold" },
    });
    expect(fixtureApi.state().users.get("contributor")?.me.display_name).toBe(
      "Morwen the Bold"
    );
  });

  it("injects failures through the control endpoint", async () => {
    await mswSend({
      method: "POST",
      path: "/__fixtures/fail",
      ...json({ userId: "contributor", operationId: "getMe", status: 500 }),
    });
    const me = () =>
      mswSend({
        method: "GET",
        path: "/v1/me",
        authorization: bearer("contributor"),
      });
    expect([(await me()).status, (await me()).status]).toEqual([500, 200]);
  });

  it("starts every test from fresh state", () => {
    expect(fixtureApi.state().users.get("contributor")?.me).toEqual(
      SEED_USERS.contributor
    );
  });

  it("refuses requests outside the API and records them, to fail the test", async () => {
    const consoleError = vi.spyOn(console, "error").mockReturnValue();
    await expect(fetch("https://elsewhere.test/")).rejects.toThrow();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
    expect(fixtureApi.takeUnhandled()).toEqual(["GET https://elsewhere.test/"]);
  });
});
