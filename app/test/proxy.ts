import type { ActionFunctionArgs } from "react-router";
import { routeArgs } from "./context";

type Action = (args: ActionFunctionArgs) => Promise<unknown>;

/**
 * Call a route action the way React Router does; a thrown Response (such as
 * a CSRF rejection) is returned so tests can assert on it, and a `data()`
 * answer becomes a JSON Response with its status and headers.
 */
export async function runAction(
  action: Action,
  request: Request,
  params: ActionFunctionArgs["params"] = {}
): Promise<Response> {
  try {
    const result = await action(routeArgs(request, { params }));
    if (result instanceof Response) return result;
    const { data, init } = result as {
      readonly data: unknown;
      readonly init: ResponseInit | null;
    };
    return Response.json(data, init ?? {});
  } catch (thrown) {
    if (thrown instanceof Response) return thrown;
    throw thrown;
  }
}
