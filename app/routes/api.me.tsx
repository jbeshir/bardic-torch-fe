import type { ActionFunctionArgs } from "@remix-run/cloudflare";
import { updateMeFormSchema } from "~/schemas/api";
import {
  methodNotAllowed,
  proxyResponse,
  readFormBody,
  updateMe,
} from "~/server/api.server";
import { assertSameOrigin } from "~/server/csrf.server";

/** PATCH /api/me (form field `display_name`) → `updateMe`. */
export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method !== "PATCH") return methodNotAllowed("PATCH");
  assertSameOrigin(request);

  const body = await readFormBody(request, updateMeFormSchema);
  if (!body.ok) return proxyResponse(body);
  return proxyResponse(await updateMe(request, context, body.data));
}
