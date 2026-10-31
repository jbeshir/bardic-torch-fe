import { readFileSync } from "node:fs";
import { parse } from "yaml";

/** The committed contract, parsed, and helpers to walk its operations. */

type MediaObject = { schema?: { $ref?: string } };

type ResponseObject = {
  $ref?: string;
  content?: Record<string, MediaObject>;
};

type OperationObject = {
  operationId?: string;
  security?: Record<string, string[]>[];
  requestBody?: { content?: Record<string, MediaObject> };
  responses: Record<string, ResponseObject>;
};

type SpecDocument = {
  openapi: string;
  security?: Record<string, string[]>[];
  components: {
    responses: Record<string, ResponseObject>;
    schemas: Record<string, unknown>;
  };
  paths: Record<string, Record<string, unknown>>;
};

const HTTP_METHODS = [
  "get",
  "put",
  "post",
  "delete",
  "options",
  "head",
  "patch",
  "trace",
] as const;

export function loadSpec(): SpecDocument {
  return parse(readFileSync("api/openapi.yaml", "utf8")) as SpecDocument;
}

type SpecOperation = {
  readonly method: string;
  readonly path: string;
  readonly operation: OperationObject;
};

export function specOperations(
  spec: SpecDocument = loadSpec()
): SpecOperation[] {
  return Object.entries(spec.paths).flatMap(([path, item]) =>
    HTTP_METHODS.filter(method => method in item).map(method => ({
      method: method.toUpperCase(),
      path,
      operation: item[method] as OperationObject,
    }))
  );
}

/** A response object with a `#/components/responses/…` reference resolved. */
export function resolveResponse(
  spec: SpecDocument,
  response: ResponseObject | undefined
): ResponseObject | undefined {
  if (!response?.$ref) return response;
  return spec.components.responses[response.$ref.split("/").pop() ?? ""];
}
