import { IconEye, IconEyeOff, IconSearch } from "@tabler/icons-react";
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
import { Link } from "~/components/ui/Link";
import { isUserUrl } from "~/catalogue/user-url";
import { TAKEDOWN_PATH } from "~/constants/moderation";
import { LINK_ROLE_LABELS } from "~/constants/vocabulary";
import { readPath } from "~/editing/editor-data";
import { isEntityId } from "~/schemas/address";
import { getModerationLink, setLinkHidden } from "~/server/api.server";
import {
  moderatorCheck,
  postedForm,
  redirectSignedOut,
  UNREADABLE_FORM,
} from "~/server/moderation.server";

/**
 * /moderation/links, takedown (plan §5.4): find a link by its address
 * (`?url=`, a GET form), see where it is attached, and hide it everywhere
 * or restore it by its ID, with a document POST to this route's action.
 * The contact inbox links here with a request's address.
 */

export const meta = () => [
  { title: "Take down a link · Bardic Torch" },
  { name: "robots", content: "noindex" },
];

const takedownHref = (url: string, done?: "hidden" | "restored") =>
  `${TAKEDOWN_PATH}?${new URLSearchParams({ url, ...(done ? { done } : {}) })}`;

export async function loader({ request, url, context }: LoaderFunctionArgs) {
  const address = (url.searchParams.get("url") ?? "").trim();
  const done = url.searchParams.get("done");
  const shown = {
    address,
    done: done === "hidden" || done === "restored" ? done : null,
  };
  if (address === "") {
    const check = await moderatorCheck(request, context, url);
    return data(
      { ...shown, link: null, error: check.error },
      { headers: check.headers }
    );
  }
  const result = await getModerationLink(request, context, address);
  redirectSignedOut(result, url);
  if (!result.ok) {
    return data(
      { ...shown, link: null, error: result.error.message },
      { status: result.status, headers: result.headers }
    );
  }
  return data(
    { ...shown, link: result.data, error: null },
    { headers: result.headers }
  );
}

export async function action({ request, context }: ActionFunctionArgs) {
  const form = await postedForm(request);
  const id = String(form?.get("link_id") ?? "");
  const hidden = form?.get("hidden");
  const address = String(form?.get("url") ?? "");
  if (!isEntityId(id) || (hidden !== "true" && hidden !== "false")) {
    return data({ message: UNREADABLE_FORM }, { status: 400 });
  }
  const result = await setLinkHidden(request, context, id, {
    hidden: hidden === "true",
  });
  if (!result.ok) {
    return data(
      { message: result.error.message },
      { status: result.status, headers: result.headers }
    );
  }
  return redirect(
    takedownHref(address, hidden === "true" ? "hidden" : "restored"),
    { status: 303, headers: result.headers }
  );
}

export default function TakedownRoute() {
  const { address, done, link, error } = useLoaderData<typeof loader>();
  const failed = useActionData<typeof action>();
  return (
    <>
      <h1 className="text-h1 text-fg">Take down a link</h1>
      <ModerationNav />
      <p className="mt-6 max-w-prose text-body text-fg">
        Find a link by its address. Hiding it takes it off every page of the
        site, and restoring it brings it back.
      </p>
      <Form method="get" className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 basis-64">
          <Field label="Address (URL)">
            <Input name="url" type="url" defaultValue={address} />
          </Field>
        </div>
        <Button type="submit" icon={IconSearch}>
          Find
        </Button>
      </Form>
      <div className="mt-6 grid gap-4">
        {done ? (
          <Alert
            tone="success"
            title={
              done === "hidden"
                ? "The link is hidden everywhere."
                : "The link is shown again."
            }
          />
        ) : null}
        {failed ? (
          <Alert tone="danger" title="We couldn’t change that link.">
            {failed.message}
          </Alert>
        ) : null}
        {error === null ? null : <Alert tone="danger">{error}</Alert>}
      </div>
      {link === null ? null : (
        <section
          aria-labelledby="found-link"
          className="mt-6 rounded-lg border border-border bg-surface p-4 md:p-5"
        >
          <h2 id="found-link" className="text-h3 text-fg">
            {link.title ?? "Untitled link"}
          </h2>
          <p className="mt-1 text-body-sm break-words">
            {isUserUrl(link.url) ? (
              <Link to={link.url} userContent appearance="prose">
                {link.url}
              </Link>
            ) : (
              link.url
            )}
          </p>
          <p className="mt-3 text-body-sm font-semibold text-fg">
            {link.is_hidden ? "Hidden from the site" : "Shown on the site"}
          </p>
          {link.attachments.length === 0 ? null : (
            <>
              <h3 className="mt-4 text-body-sm font-semibold text-fg">
                Attached to
              </h3>
              <ul role="list" className="mt-1 stack-y-1 text-body-sm">
                {link.attachments.map(attachment => (
                  <li key={`${attachment.entity_type}:${attachment.slug}`}>
                    <Link
                      to={readPath(attachment.entity_type, attachment.slug)}
                      compact
                    >
                      {attachment.title}
                    </Link>
                    {attachment.roles.length > 0
                      ? ` (${attachment.roles.map(role => LINK_ROLE_LABELS[role]).join(", ")})`
                      : null}
                  </li>
                ))}
              </ul>
            </>
          )}
          <Form method="post" reloadDocument className="mt-4">
            <input type="hidden" name="link_id" value={link.id} />
            <input type="hidden" name="url" value={address} />
            <input
              type="hidden"
              name="hidden"
              value={link.is_hidden ? "false" : "true"}
            />
            {link.is_hidden ? (
              <Button type="submit" icon={IconEye}>
                Restore the link
              </Button>
            ) : (
              <Button type="submit" variant="danger" icon={IconEyeOff}>
                Hide the link everywhere
              </Button>
            )}
          </Form>
        </section>
      )}
    </>
  );
}
