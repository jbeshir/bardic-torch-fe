import { describe, expect, it } from "vitest";
import { SEED_USERS } from "../fixture-api/data";
import {
  CATALOGUE_READS,
  parseCatalogueRequest,
  type CatalogueReadId,
} from "../fixture-api/catalogue/query";
import { OPERATIONS, type FixtureOperationId } from "../fixture-api/operations";
import {
  createFixtureState,
  handleFixtureRequest,
  type FixtureState,
} from "../fixture-api/router";
import { declaredErrorStatuses, responseProblems } from "../fixture-api/spec";
import { specOperations } from "./openapi";
import { INVALID_REQUESTS, VALID_REQUESTS } from "./requests";
import {
  bearer,
  createUser,
  json,
  runScenario,
  SCENARIOS,
  type Send,
} from "./scenarios";

const FE1_OPERATIONS: readonly FixtureOperationId[] = ["getMe", "updateMe"];

/** Send through the router, as both transports do. */
function directSend(state: FixtureState): Send {
  return async request => {
    const { pathname, search } = new URL(
      request.path,
      "http://fixture.invalid"
    );
    const response = handleFixtureRequest(state, {
      method: request.method,
      pathname,
      search,
      authorization: request.authorization ?? null,
      contentType: request.contentType ?? null,
      body: request.body ?? "",
    });
    return { status: response.status, body: response.body };
  };
}

describe("operation table", () => {
  it("serves the FE1 operations, the health check and the catalogue reads", () => {
    expect(Object.keys(OPERATIONS).sort()).toEqual(
      [...FE1_OPERATIONS, "getHealthz", ...Object.keys(CATALOGUE_READS)].sort()
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

  it.each(Object.keys(CATALOGUE_READS) as CatalogueReadId[])(
    "%s has a success and a scenario for every status the spec declares",
    operationId => {
      const statuses = SCENARIOS.filter(
        scenario => scenario.operationId === operationId
      ).map(scenario => scenario.status);
      expect(statuses).toContain(200);
      for (const status of declaredErrorStatuses(operationId)) {
        expect(statuses, `${operationId} ${status}`).toContain(status);
      }
    }
  );

  it("sends a %2F path parameter to 404 for every operation that has one", () => {
    const withSlash = SCENARIOS.filter(scenario =>
      scenario.path.includes("%2F")
    );
    const pathOperations = (
      Object.keys(CATALOGUE_READS) as CatalogueReadId[]
    ).filter(operationId => OPERATIONS[operationId].path.includes("{"));
    expect(withSlash.map(scenario => scenario.operationId).sort()).toEqual(
      [...pathOperations].sort()
    );
    expect(withSlash.every(scenario => scenario.status === 404)).toBe(true);
  });

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
  });

  it("creates users with a role, a name or blocked", async () => {
    const send = directSend(createFixtureState());
    const id = await createUser(send, {
      role: "moderator",
      display_name: "Wynn the Watchful",
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
    const blocked = await createUser(send, { blocked: true });
    expect(
      await send({
        method: "GET",
        path: "/v1/me",
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
      ...json({ userId, operationId: "updateMe", status: 500 }),
    });
    const status = async (path: string) =>
      (await send({ method: "GET", path, authorization: bearer(userId) }))
        .status;
    expect(await status("/v1/me")).toBe(200);
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
    ["a user_api bearer", `Bearer user_api|${"0".repeat(64)}`],
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
  ] as const)("catches %s", (_label, operationId, status, body) => {
    expect(responseProblems(operationId, status, body)).not.toEqual([]);
  });
});

describe("catalogue request parsing", () => {
  const get = (path: string) =>
    directSend(createFixtureState())({ method: "GET", path });

  it.each(INVALID_REQUESTS.map(request => [request.name, request] as const))(
    "answers 400 to %s",
    async (_name, { path, message }) => {
      expect(await get(path)).toEqual({
        status: 400,
        body: { code: "invalid_request", message },
      });
    }
  );

  it.each(VALID_REQUESTS.map(request => [request.name, request] as const))(
    "accepts %s",
    async (_name, { path }) => {
      expect((await get(path)).status).not.toBe(400);
    }
  );

  it.each([
    ["a slug", "/v1/pieces/the-lay%2Fhistory"],
    ["a lower-case %2f", "/v1/persons/wren%2fvale"],
    ["a history slug", "/v1/events/a%2Fb/history"],
    ["an id", "/v1/collections/1%2F2"],
    ["an authenticated operation's id", "/v1/tokens/a%2Fb"],
    ["a bad percent-encoding", "/v1/pieces/%zz"],
  ])(
    "answers 404 no such route for %s with a raw %%2F",
    async (_label, path) => {
      expect(await get(path)).toEqual({
        status: 404,
        body: { code: "not_found", message: "no such route" },
      });
    }
  );

  it("reads every catalogue read's rules from the spec", () => {
    expect(Object.keys(CATALOGUE_READS).sort()).toEqual(
      specOperations()
        .filter(({ operation }) => operation.security?.length === 0)
        .map(({ operation }) => operation.operationId)
        .filter(id => id !== "getHealthz" && id !== "getReadyz")
        .sort()
    );
  });

  it.each(Object.keys(CATALOGUE_READS) as CatalogueReadId[])(
    "%s may fail with exactly the error statuses the spec declares",
    operationId => {
      expect(
        Object.keys(CATALOGUE_READS[operationId].errors).map(Number)
      ).toEqual(declaredErrorStatuses(operationId));
    }
  );

  describe("with terms", () => {
    const FACETS = new Map([
      ["swords", "topic"],
      ["eerie", "mood"],
      ["northmarch", "affiliation"],
    ] as const);
    const termFacet = (slug: string) =>
      FACETS.get(slug as "swords" | "eerie" | "northmarch");
    const parse = (operationId: CatalogueReadId, search: string) =>
      parseCatalogueRequest(operationId, {}, search, termFacet);

    it("accepts public piece terms, a repeated one counted once", () => {
      const parsed = parse(
        "listPieces",
        `?term=swords&term=eerie&${Array.from({ length: 20 }, () => "term=swords").join("&")}`
      );
      expect(parsed.ok && parsed.query.getAll("term")).toHaveLength(22);
    });

    it.each([
      [
        "an affiliation as a term",
        "listPieces",
        "?term=northmarch",
        "unknown term: northmarch",
      ],
      [
        "an unknown term after a known one",
        "listPieces",
        "?term=eerie&term=draft-topic",
        "unknown term: draft-topic",
      ],
      [
        "a piece term as an affiliation",
        "listPersons",
        "?affiliation=swords",
        "unknown affiliation: swords",
      ],
    ] as const)("rejects %s", (_label, operationId, search, message) => {
      expect(parse(operationId, search)).toEqual({
        ok: false,
        response: { status: 400, body: { code: "invalid_request", message } },
      });
    });

    it("accepts a public affiliation", () => {
      expect(parse("listPersons", "?affiliation=northmarch").ok).toBe(true);
    });

    it("answers the decoded declared parameters only, in order", () => {
      const parsed = parse(
        "listPieces",
        "?utm=x&q=rock+and+roll&kind=song&kind=poem&term=eerie"
      );
      expect(parsed.ok && [...parsed.query]).toEqual([
        ["term", "eerie"],
        ["kind", "song"],
        ["kind", "poem"],
        ["q", "rock and roll"],
      ]);
    });

    it("ignores rules for parameters the operation doesn't declare", () => {
      expect(
        parse("listEvents", "?term=Swords&sort=relevance&affiliation=x").ok
      ).toBe(true);
    });
  });
});

describe("failures for public operations", () => {
  function setUp(options: { requireMatch?: boolean } = {}) {
    const send = directSend(createFixtureState(options));
    const fail = async (failure: Record<string, unknown>) =>
      (
        await send({
          method: "POST",
          path: "/__fixtures/fail",
          ...json(failure),
        })
      ).status;
    /** The status of an injected failure or a 400; "no failure" otherwise. */
    const status = async (path: string) => {
      const { status, body } = await send({ method: "GET", path });
      const injected =
        (body as { message?: string }).message === "injected failure";
      return injected || status === 400 ? status : "no failure";
    };
    return { send, fail, status };
  }

  it("fail every request without a match, outside the Node server", async () => {
    const { fail, status } = setUp();
    expect(await fail({ operationId: "listPieces", status: 500 })).toBe(204);
    expect(await status("/v1/pieces?q=anything")).toBe(500);
    expect(await status("/v1/pieces?q=anything")).not.toBe(500);
  });

  it("fire only for a request with every match pair, query or path", async () => {
    const { send, fail, status } = setUp({ requireMatch: true });
    expect(
      await fail({
        operationId: "listPieces",
        status: 500,
        times: 2,
        match: { q: "timeout-7f2", kind: "poem" },
      })
    ).toBe(204);
    expect(
      await fail({
        operationId: "getPiece",
        status: 404,
        match: { slug: "e2e-404-a1" },
      })
    ).toBe(204);

    expect(await status("/v1/pieces?q=timeout-7f2")).not.toBe(500);
    expect(await status("/v1/pieces?q=other&kind=poem")).not.toBe(500);
    expect(
      await send({
        method: "GET",
        path: "/v1/pieces?kind=song&kind=poem&q=timeout-7f2",
      })
    ).toEqual({
      status: 500,
      body: { code: "internal", message: "injected failure" },
    });
    expect(await status("/v1/pieces/e2e-404-b2")).not.toBe(404);
    expect(
      await send({ method: "GET", path: "/v1/pieces/e2e-404-a1" })
    ).toEqual({
      status: 404,
      body: { code: "not_found", message: "injected failure" },
    });
    expect(await status("/v1/pieces?q=timeout-7f2&kind=poem")).toBe(500);
    expect(await status("/v1/pieces?q=timeout-7f2&kind=poem")).not.toBe(500);
  });

  it("answer 400 to an invalid request first, and keep the failure", async () => {
    const { fail, status } = setUp();
    await fail({ operationId: "listPieces", status: 500, match: { q: "x1" } });
    expect(await status("/v1/pieces?q=x1&limit=0")).toBe(400);
    expect(await status("/v1/pieces?q=x1")).toBe(500);
  });

  it("keep failures with different matches apart", async () => {
    const { fail, status } = setUp({ requireMatch: true });
    await fail({ operationId: "getTerm", status: 500, match: { slug: "a" } });
    await fail({ operationId: "getTerm", status: 404, match: { slug: "b" } });
    expect(await status("/v1/terms/b")).toBe(404);
    expect(await status("/v1/terms/a")).toBe(500);
  });

  it.each([
    ["no match", { operationId: "listPieces", status: 500 }],
    ["an empty match", { operationId: "listPieces", status: 500, match: {} }],
    [
      "a match on a parameter the operation lacks",
      { operationId: "getPiece", status: 500, match: { q: "x" } },
    ],
    [
      "a match value that isn't a string",
      {
        operationId: "getCollection",
        status: 500,
        match: { collection_id: 12 },
      },
    ],
    [
      "a match on the health check, which has no parameters",
      { operationId: "getHealthz", status: 500, match: { q: "x" } },
    ],
    [
      "an undeclared status",
      { operationId: "listPieces", status: 404, match: { q: "x" } },
    ],
  ])("are refused with %s on the Node server", async (_label, failure) => {
    const { fail } = setUp({ requireMatch: true });
    expect(await fail(failure)).toBe(400);
  });

  it("don't need a match for an authenticated operation on the Node server", async () => {
    const { fail } = setUp({ requireMatch: true });
    expect(
      await fail({ userId: "contributor", operationId: "getMe", status: 500 })
    ).toBe(204);
  });
});

describe("outages", () => {
  function setUp(options: { requireMatch?: boolean } = {}) {
    const state = createFixtureState(options);
    const request = (method: string, path: string, body?: unknown) => {
      const { pathname, search } = new URL(path, "http://fixture.invalid");
      return handleFixtureRequest(state, {
        method,
        pathname,
        search,
        authorization: null,
        contentType: body === undefined ? null : "application/json",
        body: body === undefined ? "" : JSON.stringify(body),
      });
    };
    const outage = (body: Record<string, unknown>) =>
      request("POST", "/__fixtures/outage", body).status;
    return { request, outage };
  }

  it.each([
    ["503", 503, "text/plain; charset=utf-8", "503 Service Unavailable"],
    ["html-502", 502, "text/html; charset=utf-8", "<h1>502 Bad Gateway</h1>"],
  ] as const)(
    "answer %s outside the spec, for matching requests only, the given times",
    (mode, status, contentType, text) => {
      const { request, outage } = setUp({ requireMatch: true });
      expect(
        outage({
          operationId: "listPieces",
          mode,
          times: 2,
          match: { q: "outage-1" },
        })
      ).toBe(204);
      expect(request("GET", "/v1/pieces?q=other").status).not.toBe(status);
      const response = request("GET", "/v1/pieces?q=outage-1");
      expect(response).toMatchObject({ status, contentType });
      expect(String(response.body)).toContain(text);
      // A proxy answers before the backend would reject the request.
      expect(request("GET", "/v1/pieces?q=outage-1&limit=0").status).toBe(
        status
      );
      expect(request("GET", "/v1/pieces?q=outage-1").status).not.toBe(status);
    }
  );

  it("cut off a served public operation without a match outside the Node server", () => {
    const { request, outage } = setUp();
    expect(outage({ operationId: "getHealthz", mode: "503" })).toBe(204);
    expect(request("GET", "/healthz")).toMatchObject({
      status: 503,
      contentType: "text/plain; charset=utf-8",
    });
    expect(request("GET", "/healthz")).toEqual({
      status: 200,
      body: { status: "ok" },
    });
  });

  it.each([
    ["no match", { operationId: "listPieces", mode: "503" }],
    [
      "an unknown mode",
      { operationId: "listPieces", mode: "500", match: { q: "x" } },
    ],
    [
      "an authenticated operation",
      { operationId: "getMe", mode: "503", match: { q: "x" } },
    ],
    [
      "an unrouted operation",
      { operationId: "getReadyz", mode: "503", match: {} },
    ],
    [
      "zero times",
      { operationId: "listPieces", mode: "503", times: 0, match: { q: "x" } },
    ],
  ])("are refused with %s on the Node server", (_label, body) => {
    expect(setUp({ requireMatch: true }).outage(body)).toBe(400);
  });
});
