import { Validator } from "@seriousme/openapi-schema-validator";
import { describe, expect, it } from "vitest";
import { loadSpec, resolveResponse, specOperations } from "./openapi";

const schemaRef = (name: string) => ({
  "application/json": { schema: { $ref: `#/components/schemas/${name}` } },
});

/** What FE1 relies on, per operation: route, request body and success body. */
const FE1_OPERATIONS = [
  {
    operationId: "getHealthz",
    method: "GET",
    path: "/healthz",
    success: { status: "200", schema: "HealthStatus" },
  },
  {
    operationId: "getMe",
    method: "GET",
    path: "/v1/me",
    success: { status: "200", schema: "User" },
  },
  {
    operationId: "updateMe",
    method: "PATCH",
    path: "/v1/me",
    requestBody: "UpdateMeRequest",
    success: { status: "200", schema: "User" },
  },
  {
    operationId: "listAPITokens",
    method: "GET",
    path: "/v1/tokens",
    success: { status: "200", schema: "APITokenList" },
  },
  {
    operationId: "createAPIToken",
    method: "POST",
    path: "/v1/tokens",
    requestBody: "CreateAPITokenRequest",
    success: { status: "201", schema: "CreatedAPIToken" },
  },
  {
    operationId: "revokeAPIToken",
    method: "DELETE",
    path: "/v1/tokens/{token_id}",
    success: { status: "204", schema: undefined },
  },
] as const;

function operationById(operationId: string) {
  return specOperations().find(
    ({ operation }) => operation.operationId === operationId
  );
}

describe("api/openapi.yaml", () => {
  it("is a valid OpenAPI 3.1 document", async () => {
    const spec = loadSpec();
    const result = await new Validator().validate(structuredClone(spec));
    expect(result).toEqual({ valid: true });
    expect(spec.openapi).toMatch(/^3\.1\.\d+$/);
  });

  it("is checked by a validator that rejects an invalid document", async () => {
    const { info: _info, ...withoutInfo } = loadSpec() as Record<
      string,
      unknown
    >;
    const result = await new Validator().validate(withoutInfo);
    expect(result.valid).toBe(false);
  });

  it("gives every operation a unique operationId", () => {
    const ids = specOperations().map(({ operation }) => operation.operationId);
    expect(ids.every(id => typeof id === "string" && id !== "")).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  describe.each(FE1_OPERATIONS)(
    "$operationId",
    ({ operationId, method, path, success, ...rest }) => {
      it(`is ${method} ${path}`, () => {
        expect(operationById(operationId)).toMatchObject({ method, path });
      });

      it(`answers ${success.status} with ${success.schema ?? "no body"}`, () => {
        const { operation } = operationById(operationId) ?? {};
        const response = operation?.responses[success.status];
        expect(response).toBeDefined();
        if (success.schema) {
          expect(response?.content).toMatchObject(schemaRef(success.schema));
        } else {
          expect(response?.content).toBeUndefined();
        }
      });

      it("takes the expected request body", () => {
        const { operation } = operationById(operationId) ?? {};
        const requestBody =
          "requestBody" in rest ? rest.requestBody : undefined;
        if (requestBody) {
          expect(operation?.requestBody?.content).toMatchObject(
            schemaRef(requestBody)
          );
        } else {
          expect(operation?.requestBody).toBeUndefined();
        }
      });
    }
  );

  it("requires an Auth0 bearer for every FE1 operation except the health check", () => {
    const spec = loadSpec();
    const authenticated = FE1_OPERATIONS.filter(
      ({ operationId }) => operationId !== "getHealthz"
    ).map(({ operationId }) => {
      const security =
        operationById(operationId)?.operation.security ?? spec.security;
      return security?.some(requirement => "auth0Bearer" in requirement);
    });
    expect(authenticated.every(Boolean)).toBe(true);
    expect(operationById("getHealthz")?.operation.security).toEqual([]);
  });

  it("describes every error response with the shared Error schema", () => {
    const spec = loadSpec();
    const errorResponses = specOperations().flatMap(({ operation }) =>
      Object.entries(operation.responses)
        .filter(([status]) => Number(status) >= 400)
        .map(([, response]) => resolveResponse(spec, response))
    );
    expect(errorResponses.length).toBeGreaterThan(0);
    for (const response of errorResponses) {
      expect(response?.content).toMatchObject(schemaRef("Error"));
    }
  });
});
