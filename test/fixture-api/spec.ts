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
type Reference = { $ref: string };
/** A parameter's schema, as far as the fixture's request parser reads it. */
export type ParameterSchema = {
  readonly type?: string;
  readonly format?: string;
  readonly enum?: readonly string[];
  readonly pattern?: string;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly maxItems?: number;
  readonly uniqueItems?: boolean;
  readonly items?: ParameterSchema;
};
type ParameterObject = {
  name: string;
  in: string;
  style?: string;
  explode?: boolean;
  schema: ParameterSchema | Reference;
};
type OperationObject = {
  operationId: string;
  parameters?: (ParameterObject | Reference)[];
  responses: Record<string, ResponseObject>;
};
type SpecDocument = {
  paths: Record<string, Record<string, OperationObject>>;
  components: {
    parameters: Record<string, ParameterObject>;
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

const routesById = new Map(
  Object.entries(spec.paths).flatMap(([path, item]) =>
    Object.entries(item).map(
      ([method, operation]) =>
        [
          operation.operationId,
          { method: method.toUpperCase(), path, operation },
        ] as const
    )
  )
);
const operationsById = new Map(
  [...routesById].map(([id, { operation }]) => [id, operation])
);

const lastSegment = (ref: string) => ref.split("/").pop() ?? "";

function isReference(value: object): value is Reference {
  return "$ref" in value;
}

/** A parameter schema with its `$ref`s (and its items' `$ref`s) resolved. */
function resolveSchema(schema: ParameterSchema | Reference): ParameterSchema {
  const resolved = isReference(schema)
    ? (spec.components.schemas[lastSegment(schema.$ref)] as ParameterSchema)
    : schema;
  return resolved.items
    ? { ...resolved, items: resolveSchema(resolved.items) }
    : resolved;
}

/** A path or query parameter of an operation, `$ref`s resolved. */
export type SpecParameter = {
  readonly name: string;
  readonly in: "path" | "query";
  /** Whether the parameter may be repeated (`style: form`, `explode`). */
  readonly repeatable: boolean;
  readonly schema: ParameterSchema;
};

/**
 * An operation's method, path template and parameters, from the spec.
 * Throws for an operationId the spec doesn't have, or a parameter the
 * fixture can't read: one in neither the path nor the query, or an array
 * not sent as repeated `name=value` pairs.
 */
export function specRoute(operationId: OperationId): {
  method: string;
  path: string;
  parameters: SpecParameter[];
} {
  const route = routesById.get(operationId);
  if (!route) throw new Error(`The spec has no operation ${operationId}`);
  const parameters = (route.operation.parameters ?? []).map(parameter => {
    const object = isReference(parameter)
      ? spec.components.parameters[lastSegment(parameter.$ref)]
      : parameter;
    if (!object || (object.in !== "path" && object.in !== "query")) {
      throw new Error(`${operationId} has a parameter the fixture can't read`);
    }
    const schema = resolveSchema(object.schema);
    const repeatable = schema.type === "array";
    if (
      repeatable &&
      (object.in !== "query" ||
        (object.style ?? "form") !== "form" ||
        object.explode === false)
    ) {
      throw new Error(`${operationId} ${object.name} isn't form, explode`);
    }
    return { name: object.name, in: object.in, repeatable, schema } as const;
  });
  return { method: route.method, path: route.path, parameters };
}

function declaredResponse(
  operationId: string,
  status: number
): ResponseObject | undefined {
  const response = operationsById.get(operationId)?.responses[String(status)];
  if (!response?.$ref) return response;
  return spec.components.responses[lastSegment(response.$ref)];
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
