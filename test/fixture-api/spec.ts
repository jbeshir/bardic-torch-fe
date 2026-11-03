import { readFileSync } from "node:fs";
import { Ajv2020, type ValidateFunction } from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { parse } from "yaml";
import type { operations } from "../../app/api/schema.gen";

/**
 * Validates fixture responses against `api/openapi.yaml`. OpenAPI 3.1 schemas
 * are JSON Schema 2020-12, so the component schemas are loaded into ajv's
 * 2020-12 validator as `$defs` and each response body is checked against
 * the schema its operation declares for the status.
 */

type OperationId = keyof operations;

type MediaObject = { schema?: unknown };
type ResponseObject = {
  $ref?: string;
  content?: Record<string, MediaObject>;
};
type OperationObject = {
  operationId: string;
  responses: Record<string, ResponseObject>;
};
type SpecDocument = {
  paths: Record<string, Record<string, OperationObject>>;
  components: {
    responses: Record<string, ResponseObject>;
    schemas: Record<string, unknown>;
  };
};

const SPEC_ID = "https://fixture.invalid/openapi.json";

const spec = parse(readFileSync("api/openapi.yaml", "utf8")) as SpecDocument;

/** Rewrite `#/components/schemas/…` references to the `$defs` loaded below. */
function toDefs(schema: unknown): unknown {
  return JSON.parse(
    JSON.stringify(schema).replaceAll(
      '"#/components/schemas/',
      `"${SPEC_ID}#/$defs/`
    )
  );
}

const ajv = new Ajv2020({ allErrors: true, allowUnionTypes: true });
addFormats(ajv);
ajv.addSchema({ $id: SPEC_ID, $defs: toDefs(spec.components.schemas) });

const validators = new Map<string, ValidateFunction>();

function validatorFor(key: string, schema: unknown): ValidateFunction {
  const cached = validators.get(key);
  if (cached) return cached;
  const validate = ajv.compile(toDefs(schema) as object);
  validators.set(key, validate);
  return validate;
}

const operationsById = new Map(
  Object.values(spec.paths).flatMap(item =>
    Object.values(item).map(operation => [operation.operationId, operation])
  )
);

function declaredResponse(
  operationId: string,
  status: number
): ResponseObject | undefined {
  const response = operationsById.get(operationId)?.responses[String(status)];
  if (!response?.$ref) return response;
  return spec.components.responses[response.$ref.split("/").pop() ?? ""];
}

/** The error statuses the spec declares for an operation. */
export function declaredErrorStatuses(operationId: OperationId): number[] {
  return Object.keys(operationsById.get(operationId)?.responses ?? {})
    .map(Number)
    .filter(status => status >= 400);
}

/**
 * Problems with `body` as the `status` response of `operationId`; empty
 * means valid. An undeclared status, or a body on a response the spec
 * declares without content, is a problem too.
 */
export function responseProblems(
  operationId: OperationId,
  status: number,
  body: unknown
): string[] {
  const response = declaredResponse(operationId, status);
  if (!response) return [`${operationId} does not declare status ${status}`];
  const schema = response.content?.["application/json"]?.schema;
  if (schema === undefined) {
    return body === undefined ? [] : [`${operationId} ${status} has no body`];
  }
  const validate = validatorFor(`${operationId} ${status}`, schema);
  if (validate(body)) return [];
  return (validate.errors ?? []).map(
    error => `${error.instancePath || "/"} ${error.message ?? error.keyword}`
  );
}
