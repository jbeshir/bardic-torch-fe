import type { ActionFunctionArgs } from "@remix-run/cloudflare";
import { updateMeFormSchema } from "~/schemas/api";
import { methodNotAllowed, proxyForm, updateMe } from "~/server/api.server";
import { assertSameOrigin } from "~/server/csrf.server";

/** PATCH /api/me (form field `display_name`) → `updateMe`. */
export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method !== "PATCH") return methodNotAllowed("PATCH");
  assertSameOrigin(request);

  return proxyForm(request, context, updateMeFormSchema, data =>
    updateMe(request, context, data)
  );
}
