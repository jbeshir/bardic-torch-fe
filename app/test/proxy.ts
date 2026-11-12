import type { ActionFunctionArgs } from "react-router";
import { routeArgs } from "./context";

type Action = (args: ActionFunctionArgs) => Promise<unknown>;

type DataAnswer = {
  readonly data: unknown;
  readonly init: ResponseInit | null;
};

const isDataAnswer = (value: unknown): value is DataAnswer =>
  typeof value === "object" &&
  value !== null &&
  "data" in value &&
  "init" in value;

/** A Response as it is, and a `data()` answer as a JSON Response. */
const asResponse = (answer: Response | DataAnswer) =>
  answer instanceof Response
    ? answer
    : Response.json(answer.data, answer.init ?? {});

/**
 * Call a route action the way React Router does; a thrown Response (such as
 * a CSRF rejection) or `data()` (a failed read) is returned so tests can
 * assert on it, and a `data()` answer becomes a JSON Response with its
 * status and headers.
 */
export async function runAction(
  action: Action,
  request: Request,
  params: ActionFunctionArgs["params"] = {}
): Promise<Response> {
  try {
    return asResponse(
      (await action(routeArgs(request, { params }))) as Response | DataAnswer
    );
  } catch (thrown) {
    if (thrown instanceof Response || isDataAnswer(thrown)) {
      return asResponse(thrown);
    }
    throw thrown;
  }
}
