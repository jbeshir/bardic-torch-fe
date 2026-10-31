import type { ActionFunctionArgs } from "@remix-run/cloudflare";
import { createApiTokenFormSchema } from "~/schemas/api";
import {
  createApiToken,
  methodNotAllowed,
  proxyResponse,
  readFormBody,
} from "~/server/api.server";
import { assertSameOrigin } from "~/server/csrf.server";

/** POST /api/tokens (optional form field `name`) → `createAPIToken`. */
export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method !== "POST") return methodNotAllowed("POST");
  assertSameOrigin(request);

  const body = await readFormBody(request, createApiTokenFormSchema);
  if (!body.ok) return proxyResponse(body);
  return proxyResponse(await createApiToken(request, context, body.data));
}
