import { describe, expect, it } from "vitest";
import { SAMPLE_TOKENS, SEED_USERS } from "../fixture-api/data";
import { OPERATIONS, type FixtureOperationId } from "../fixture-api/operations";
import {
  createFixtureState,
  handleFixtureRequest,
  type FixtureState,
} from "../fixture-api/router";
import { declaredErrorStatuses, responseProblems } from "../fixture-api/spec";
import { specOperations } from "./openapi";
import {
  bearer,
  createUser,
  json,
  runScenario,
  SCENARIOS,
  type Send,
} from "./scenarios";

const FE1_OPERATIONS: readonly FixtureOperationId[] = [
  "getMe",
  "updateMe",
  "listAPITokens",
  "createAPIToken",
  "revokeAPIToken",
];

/** Send through the router, as both transports do. */
function directSend(state: FixtureState): Send {
  return async request => {
    const response = handleFixtureRequest(state, {
      method: request.method,
      pathname: request.path,
      authorization: request.authorization ?? null,
      contentType: request.contentType ?? null,
      body: request.body ?? "",
    });
    return { status: response.status, body: response.body };
  };
}

describe("operation table", () => {
  it("serves the FE1 operations and the health check", () => {
    expect(Object.keys(OPERATIONS).sort()).toEqual(
      [...FE1_OPERATIONS, "getHealthz"].sort()
    );
  });

  it.each(Object.entries(OPERATIONS))(
    "%s is at the spec's method and path",
    (operationId, { method, path }) => {
      expect(
        specOperations().find(
          ({ operation }) => operation.operationId === operationId
        )
      ).toMatchObject({ method, path });
    }
  );

  it.each(Object.keys(OPERATIONS) as FixtureOperationId[])(
    "%s may fail with exactly the error statuses the spec declares",
    operationId => {
      expect(Object.keys(OPERATIONS[operationId].errors).map(Number)).toEqual(
        declaredErrorStatuses(operationId)
      );
    }
  );
});

describe("seed data", () => {
  it("seeds a contributor and a moderator with stage names", () => {
    expect(SEED_USERS).toEqual({
      contributor: {
        id: "fixture|contributor",
        display_name: "Morwen of the Marches",
        role: "contributor",
      },
      moderator: {
        id: "fixture|moderator",
        display_name: "Master Tobias Fiddler",
        role: "moderator",
      },
    });
  });

  it.each(Object.values(SEED_USERS))("$display_name is a valid User", user => {
    expect(responseProblems("getMe", 200, user)).toEqual([]);
  });

  it("the sample tokens are a valid list with a named, an unnamed and a never-used token", () => {
    expect(
      responseProblems("listAPITokens", 200, { data: SAMPLE_TOKENS })
    ).toEqual([]);
    expect(SAMPLE_TOKENS.some(token => token.name === null)).toBe(true);
    expect(SAMPLE_TOKENS.some(token => token.name !== null)).toBe(true);
    expect(SAMPLE_TOKENS.some(token => token.last_used_at === null)).toBe(true);
  });
});

describe("scenarios", () => {
  it.each(FE1_OPERATIONS)(
    "%s has at least one success and one error scenario",
    operationId => {
      const statuses = SCENARIOS.filter(
        scenario => scenario.operationId === operationId
      ).map(scenario => scenario.status);
      expect(statuses.some(status => status < 300)).toBe(true);
      expect(statuses.some(status => status >= 400)).toBe(true);
    }
  );

  it.each(
    SCENARIOS.map(
      scenario =>
        [`${scenario.operationId} ${scenario.name}`, scenario] as const
    )
  )("%s answers as the spec says", async (_name, scenario) => {
    const response = await runScenario(
      scenario,
      directSend(createFixtureState())
    );
    expect(response.status).toBe(scenario.status);
    expect(
      responseProblems(scenario.operationId, response.status, response.body)
    ).toEqual([]);
  });
});

describe("behaviour", () => {
  async function setUp() {
    const send = directSend(createFixtureState());
    return { send, userId: await createUser(send) };
  }

  it("normalises and trims the display name", async () => {
    const { send, userId } = await setUp();
    const response = await send({
      method: "PATCH",
      path: "/v1/me",
      authorization: bearer(userId),
      ...json({ display_name: "  Cerdic\u0301  " }),
    });
    expect(response.body).toMatchObject({
      display_name: "Cerdi\u0107",
    });
  });

  it("lists tokens newest first, a created one first with its secret's prefix", async () => {
    const { send, userId } = await setUp();
    const created = (
      await send({
        method: "POST",
        path: "/v1/tokens",
        authorization: bearer(userId),
        ...json({ name: "  CI runner  " }),
      })
    ).body as { id: string; prefix: string; name: string; token: string };
    expect(created.name).toBe("CI runner");
    expect(created.token).toBe(
      `user_api|${created.prefix}${created.token.slice(17)}`
    );
    const list = (
      await send({
        method: "GET",
        path: "/v1/tokens",
        authorization: bearer(userId),
      })
    ).body as { data: { id: string }[] };
    expect(list.data.map(token => token.id)).toEqual([
      created.id,
      ...[...SAMPLE_TOKENS].reverse().map(token => token.id),
    ]);
  });

  it("drops a revoked token from the list, and revoking it again succeeds", async () => {
    const { send, userId } = await setUp();
    const revoke = () =>
      send({
        method: "DELETE",
        path: `/v1/tokens/${SAMPLE_TOKENS[0]?.id}`,
        authorization: bearer(userId),
      });
    expect((await revoke()).status).toBe(204);
    expect((await revoke()).status).toBe(204);
    const list = (
      await send({
        method: "GET",
        path: "/v1/tokens",
        authorization: bearer(userId),
      })
    ).body as { data: { id: string }[] };
    expect(list.data.map(token => token.id)).not.toContain(
      SAMPLE_TOKENS[0]?.id
    );
  });

  it("stops at 10 active tokens with 409 token_limit_reached", async () => {
    const { send, userId } = await setUp();
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const response = await send({
        method: "POST",
        path: "/v1/tokens",
        authorization: bearer(userId),
        ...json({}),
      });
      statuses.push(response.status);
      if (response.status === 409) {
        expect(response.body).toMatchObject({ code: "token_limit_reached" });
      }
    }
    expect(statuses).toEqual([201, 201, 201, 201, 201, 201, 201, 409]);
  });
});

describe("per-user state", () => {
  it("isolates fixture users from each other", async () => {
    const send = directSend(createFixtureState());
    const [first, second] = [await createUser(send), await createUser(send)];
    expect(first).not.toBe(second);

    await send({
      method: "PATCH",
      path: "/v1/me",
      authorization: bearer(first),
      ...json({ display_name: "Changed" }),
    });
    await send({
      method: "DELETE",
      path: `/v1/tokens/${SAMPLE_TOKENS[0]?.id}`,
      authorization: bearer(first),
    });

    const me = async (userId: string) =>
      (
        await send({
          method: "GET",
          path: "/v1/me",
          authorization: bearer(userId),
        })
      ).body;
    expect(await me(first)).toMatchObject({ display_name: "Changed" });
    expect(await me(second)).not.toMatchObject({ display_name: "Changed" });
    const secondTokens = (
      await send({
        method: "GET",
        path: "/v1/tokens",
        authorization: bearer(second),
      })
    ).body as { data: unknown[] };
    expect(secondTokens.data).toHaveLength(SAMPLE_TOKENS.length);
  });

  it("creates users with a role, a name, no tokens or blocked", async () => {
    const send = directSend(createFixtureState());
    const id = await createUser(send, {
      role: "moderator",
      display_name: "Wynn the Watchful",
      tokens: "none",
    });
    expect(
      await send({ method: "GET", path: "/v1/me", authorization: bearer(id) })
    ).toEqual({
      status: 200,
      body: {
        id: `fixture|${id}`,
        display_name: "Wynn the Watchful",
        role: "moderator",
      },
    });
    expect(
      (
        await send({
          method: "GET",
          path: "/v1/tokens",
          authorization: bearer(id),
        })
      ).body
    ).toEqual({ data: [] });

    const blocked = await createUser(send, { blocked: true });
    expect(
      await send({
        method: "GET",
        path: "/v1/tokens",
        authorization: bearer(blocked),
      })
    ).toEqual({
      status: 403,
      body: { code: "user_blocked", message: "user is blocked" },
    });
  });

  it("fails only the targeted user's calls, the requested number of times", async () => {
    const send = directSend(createFixtureState());
    const [target, bystander] = [
      await createUser(send),
      await createUser(send),
    ];
    const injected = await send({
      method: "POST",
      path: "/__fixtures/fail",
      ...json({ userId: target, operationId: "getMe", status: 500, times: 2 }),
    });
    expect(injected.status).toBe(204);

    const status = async (userId: string) =>
      (
        await send({
          method: "GET",
          path: "/v1/me",
          authorization: bearer(userId),
        })
      ).status;
    expect([
      await status(target),
      await status(target),
      await status(target),
    ]).toEqual([500, 500, 200]);
    expect(await status(bystander)).toBe(200);
  });

  it("does not let a failure on one operation leak into another", async () => {
    const send = directSend(createFixtureState());
    const userId = await createUser(send);
    await send({
      method: "POST",
      path: "/__fixtures/fail",
      ...json({ userId, operationId: "listAPITokens", status: 500 }),
    });
    const status = async (path: string) =>
      (await send({ method: "GET", path, authorization: bearer(userId) }))
        .status;
    expect(await status("/v1/me")).toBe(200);
    expect(await status("/v1/tokens")).toBe(500);
  });

  it.each([
    ["an unknown operation", { operationId: "nope", status: 500 }],
    [
      "an operation it does not serve",
      { operationId: "getReadyz", status: 503 },
    ],
    ["an undeclared status", { operationId: "getMe", status: 404 }],
    [
      "a code the status does not allow",
      { operationId: "getMe", status: 403, code: "not_found" },
    ],
    ["an unknown user", { userId: "ghost", operationId: "getMe", status: 500 }],
    ["zero times", { operationId: "getMe", status: 500, times: 0 }],
  ])("rejects a failure with %s", async (_label, failure) => {
    const send = directSend(createFixtureState());
    const response = await send({
      method: "POST",
      path: "/__fixtures/fail",
      ...json({ userId: "contributor", ...failure }),
    });
    expect(response.status).toBe(400);
  });

  it("rejects an unknown role", async () => {
    const send = directSend(createFixtureState());
    const response = await send({
      method: "POST",
      path: "/__fixtures/users",
      ...json({ role: "admin" }),
    });
    expect(response.status).toBe(400);
  });

  it("serves the seed users without creating them", async () => {
    const send = directSend(createFixtureState());
    expect(
      await send({
        method: "GET",
        path: "/v1/me",
        authorization: bearer("moderator"),
      })
    ).toEqual({ status: 200, body: SEED_USERS.moderator });
  });

  it.each([
    ["an unknown user", bearer("ghost")],
    ["an API token", `Bearer user_api|${"0".repeat(64)}`],
    ["a raw Auth0 token", "Bearer auth0|eyJhbGciOiJSUzI1NiJ9.e30.sig"],
    ["no Bearer scheme", "auth0|fixture:contributor"],
  ])("treats %s as unauthenticated", async (_label, authorization) => {
    const send = directSend(createFixtureState());
    expect(
      await send({ method: "GET", path: "/v1/me", authorization })
    ).toEqual({
      status: 401,
      body: { code: "unauthenticated", message: "invalid credentials" },
    });
  });

  it("answers unknown routes with a 404 Error", async () => {
    const send = directSend(createFixtureState());
    expect(await send({ method: "GET", path: "/v1/nothing" })).toEqual({
      status: 404,
      body: { code: "not_found", message: "no such route" },
    });
  });
});

describe("spec validation of every response", () => {
  it.each([
    ["a User missing fields", "getMe", 200, { id: "u1" }],
    ["a body on a 204", "revokeAPIToken", 204, { ok: true }],
    ["an undeclared status", "getMe", 404, { code: "not_found", message: "y" }],
    [
      "an Error with an unknown code",
      "getMe",
      401,
      { code: "x", message: "y" },
    ],
    [
      "the old nested Error",
      "getMe",
      401,
      { error: { code: "unauthenticated", message: "y" } },
    ],
    [
      "an extra property",
      "getMe",
      200,
      { ...SEED_USERS.contributor, email: "x" },
    ],
    [
      "a token with a non-date created_at",
      "listAPITokens",
      200,
      { data: [{ ...SAMPLE_TOKENS[0], created_at: "yesterday" }] },
    ],
  ] as const)("catches %s", (_label, operationId, status, body) => {
    expect(responseProblems(operationId, status, body)).not.toEqual([]);
  });
});
