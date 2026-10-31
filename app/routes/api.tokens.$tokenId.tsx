import type { ActionFunctionArgs } from "@remix-run/cloudflare";
import { z } from "zod";
import {
  methodNotAllowed,
  proxyResponse,
  readFormBody,
  revokeApiToken,
} from "~/server/api.server";
import { assertSameOrigin } from "~/server/csrf.server";

/** The form carries no fields; it is still read so its size and type are checked. */
const emptyFormSchema = z.object({});

/** DELETE /api/tokens/:tokenId → `revokeAPIToken`. */
export async function action({ request, params, context }: ActionFunctionArgs) {
  if (request.method !== "DELETE") return methodNotAllowed("DELETE");
  assertSameOrigin(request);

  const body = await readFormBody(request, emptyFormSchema);
  if (!body.ok) return proxyResponse(body);
  return proxyResponse(
    await revokeApiToken(request, context, params.tokenId ?? "")
  );
}
