import type { ActionFunctionArgs } from "react-router";
import { routeArgs } from "./context";

type Action = (args: ActionFunctionArgs) => Promise<Response>;

/**
 * Call a route action the way React Router does; a thrown Response (such as
 * a CSRF rejection) is returned so tests can assert on it.
 */
export async function runAction(
  action: Action,
  request: Request,
  params: ActionFunctionArgs["params"] = {}
): Promise<Response> {
  try {
    return await action(routeArgs(request, { params }));
  } catch (thrown) {
    if (thrown instanceof Response) return thrown;
    throw thrown;
  }
}
