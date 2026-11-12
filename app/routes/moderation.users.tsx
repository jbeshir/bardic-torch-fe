import { IconUserCheck, IconUserOff } from "@tabler/icons-react";
import {
  data,
  Form,
  redirect,
  useActionData,
  useLoaderData,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { ModerationNav } from "~/components/moderation/ModerationNav";
import { Alert } from "~/components/ui/Alert";
import { Button } from "~/components/ui/Button";
import { Field } from "~/components/ui/Field";
import { Input } from "~/components/ui/Input";
import { BLOCKING_PATH } from "~/constants/moderation";
import { setUserBlocked } from "~/server/api.server";
import {
  moderatorCheck,
  postedForm,
  UNREADABLE_FORM,
} from "~/server/moderation.server";

/**
 * /moderation/users, blocking (plan §5.4): block or unblock a contributor
 * by their user ID, which the review page links here with (`?id=`), with
 * a document POST to this route's action. The API has no way to look a
 * user up, so the page can't say whether they are blocked now.
 */

export const meta = () => [
  { title: "Block a user · Bardic Torch" },
  { name: "robots", content: "noindex" },
];

export async function loader({ request, url, context }: LoaderFunctionArgs) {
  const check = await moderatorCheck(request, context, url);
  const done = url.searchParams.get("done");
  return data(
    {
      id: url.searchParams.get("id") ?? "",
      name: url.searchParams.get("name") ?? "",
      done: done === "blocked" || done === "unblocked" ? done : null,
      error: check.error,
    },
    { headers: check.headers }
  );
}

export async function action({ request, context }: ActionFunctionArgs) {
  const form = await postedForm(request);
  const id = String(form?.get("user_id") ?? "").trim();
  const blocked = form?.get("blocked");
  if (blocked !== "true" && blocked !== "false") {
    return data({ message: UNREADABLE_FORM, id }, { status: 400 });
  }
  if (id === "") {
    return data(
      { message: "Enter the user’s ID, as the review page gives it.", id },
      { status: 400 }
    );
  }
  const result = await setUserBlocked(request, context, id, {
    blocked: blocked === "true",
  });
  if (!result.ok) {
    return data(
      { message: result.error.message, id },
      { status: result.status, headers: result.headers }
    );
  }
  const done = blocked === "true" ? "blocked" : "unblocked";
  const name = result.data.display_name;
  return redirect(
    `${BLOCKING_PATH}?${new URLSearchParams({ id, done, name })}`,
    {
      status: 303,
      headers: result.headers,
    }
  );
}

export default function BlockingRoute() {
  const { id, name, done, error } = useLoaderData<typeof loader>();
  const failed = useActionData<typeof action>();
  return (
    <>
      <h1 className="text-h1 text-fg">Block a user</h1>
      <ModerationNav />
      <div className="mt-6 grid gap-4">
        {done ? (
          <Alert
            tone="success"
            title={`${name || id} is ${done === "blocked" ? "blocked" : "unblocked"}.`}
          />
        ) : null}
        {failed ? (
          <Alert tone="danger" title="We couldn’t change that user.">
            {failed.message}
          </Alert>
        ) : null}
        {error === null ? null : <Alert tone="danger">{error}</Alert>}
      </div>
      {error === null ? (
        <>
          <p className="mt-6 max-w-prose text-body text-fg">
            A blocked user can still read the site but can’t edit it. Their
            edits waiting for review stay in the queue for you to reject.
            Moderators can’t be blocked.
          </p>
          <Form method="post" reloadDocument className="mt-4 stack-y-4">
            <Field
              label="User ID"
              help="As the review page’s link gives it, such as google-oauth2|123."
            >
              <Input
                name="user_id"
                defaultValue={failed?.id ?? id}
                autoComplete="off"
                spellCheck={false}
              />
            </Field>
            {/* Unblock first: Enter in the field never blocks anyone. */}
            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                name="blocked"
                value="false"
                icon={IconUserCheck}
              >
                Unblock
              </Button>
              <Button
                type="submit"
                name="blocked"
                value="true"
                variant="danger"
                icon={IconUserOff}
              >
                Block
              </Button>
            </div>
          </Form>
        </>
      ) : null}
    </>
  );
}
