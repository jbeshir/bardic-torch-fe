import type { ActionFunctionArgs } from "@remix-run/cloudflare";
import { z } from "zod";
import {
  methodNotAllowed,
  proxyForm,
  revokeApiToken,
} from "~/server/api.server";
import { assertSameOrigin } from "~/server/csrf.server";

/** The form carries no fields; it is still read so its size and type are checked. */
const emptyFormSchema = z.object({});

/** DELETE /api/tokens/:tokenId → `revokeAPIToken`. */
export async function action({ request, params, context }: ActionFunctionArgs) {
  if (request.method !== "DELETE") return methodNotAllowed("DELETE");
  assertSameOrigin(request);

  return proxyForm(request, context, emptyFormSchema, () =>
    revokeApiToken(request, context, params.tokenId ?? "")
  );
}
