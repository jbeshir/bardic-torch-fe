import type { ActionFunctionArgs } from "react-router";
import { createApiTokenFormSchema } from "~/schemas/api";
import {
  createApiToken,
  methodNotAllowed,
  proxyForm,
} from "~/server/api.server";
import { assertSameOrigin } from "~/server/csrf.server";

/** POST /api/tokens (optional form field `name`) → `createAPIToken`. */
export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method !== "POST") return methodNotAllowed("POST");
  assertSameOrigin(request);

  return proxyForm(request, context, createApiTokenFormSchema, data =>
    createApiToken(request, context, data)
  );
}
