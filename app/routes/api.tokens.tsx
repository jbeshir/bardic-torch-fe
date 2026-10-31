import type { ActionFunctionArgs } from "@remix-run/cloudflare";
import { json } from "@remix-run/cloudflare";
import { createAuthenticatedFetch } from "~/server/auth.server";

/**
 * Proxy route for the /v1/tokens API endpoint.
 *
 * POST /api/tokens - Create a new token
 */
export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const apiBaseURL = context.cloudflare.env.BARDIC_TORCH_API_BASE_URL;
  const apiUrl = `${apiBaseURL}/v1/tokens`;

  const { authFetch, isAuthenticated } = await createAuthenticatedFetch(
    request,
    context
  );

  if (!isAuthenticated) {
    return json({ error: "Not authenticated" }, { status: 401 });
  }

  // Parse the request body for token name
  let body: { name?: string } = {};
  try {
    body = await request.json();
  } catch {
    // Body is optional for token creation
  }

  const response = await authFetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return new Response(response.body, {
    status: response.status,
    headers: {
      "Content-Type":
        response.headers.get("Content-Type") || "application/json",
    },
  });
}
