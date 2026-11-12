import { IconSend } from "@tabler/icons-react";
import {
  data,
  Form,
  redirect,
  useActionData,
  useLoaderData,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "react-router";
import { z } from "zod";
import { Turnstile } from "~/components/contact/Turnstile";
import { Alert } from "~/components/ui/Alert";
import { Button } from "~/components/ui/Button";
import { ErrorSummary } from "~/components/ui/ErrorSummary";
import { Field } from "~/components/ui/Field";
import { Input } from "~/components/ui/Input";
import { Link } from "~/components/ui/Link";
import { Select } from "~/components/ui/Select";
import { Textarea } from "~/components/ui/Textarea";
import { pageMeta } from "~/catalogue/seo";
import { CONTACT_FORM_URL, helpHref } from "~/constants/navigation";
import { CONTACT_KIND_LABELS } from "~/constants/vocabulary";
import { createContactRequest } from "~/server/api.server";
import { appEnvContext } from "~/server/context.server";
import { assertSameOrigin } from "~/server/csrf.server";

/**
 * /contact, the contact, takedown and opt-out form (plan §5.4): anyone
 * may write to the moderators, with no account. Reporting a link is the
 * same form, of kind `link_report`: each link's "Report this link" opens
 * it with `?kind=link_report&url=`. Cloudflare Turnstile guards it; the
 * API checks the token. The form is a document POST to this route's
 * action, which goes to `?sent=1` once the API has it.
 */

type Kind = keyof typeof CONTACT_KIND_LABELS;

const KINDS = Object.keys(CONTACT_KIND_LABELS) as [Kind, ...Kind[]];

const blankToNull = (value: string) => (value === "" ? null : value);

/** The form's fields, trimmed and within the API's limits, in our words. */
const contactForm = z.object({
  kind: z.enum(KINDS).catch("general"),
  name: z
    .string()
    .trim()
    .max(255, "Shorten your name to 255 characters or fewer.")
    .transform(blankToNull),
  email: z
    .string()
    .trim()
    .max(254, "Shorten your email address to 254 characters or fewer.")
    .pipe(
      z.email("Enter an email address we can reply to, like name@example.org.")
    ),
  url: z
    .string()
    .trim()
    .max(2048, "Shorten the address to 2,048 characters or fewer.")
    .transform(blankToNull),
  message: z
    .string()
    .trim()
    .min(1, "Write your message.")
    .max(5000, "Shorten your message to 5,000 characters or fewer."),
  turnstile_token: z.string().min(1),
});

type Values = {
  readonly kind: Kind;
  readonly name: string;
  readonly email: string;
  readonly url: string;
  readonly message: string;
};

const FIELD_LABELS = {
  name: "Your name",
  email: "Your email address",
  url: "Address it’s about",
  message: "Message",
} as const;

type FieldName = keyof typeof FIELD_LABELS;

const fieldId = (name: FieldName) => `contact-${name}`;

const NO_TOKEN =
  "Wait a moment for the check that you’re not a robot to finish, then send again. It needs JavaScript.";

export const meta: MetaFunction = args =>
  pageMeta(args, {
    title: "Contact us",
    description:
      "Write to the Bardic Torch moderators: ask for a link or a page to be taken down, opt out, send a correction or report a link.",
    path: CONTACT_FORM_URL,
  });

export function loader({ url, context }: LoaderFunctionArgs) {
  const kind = KINDS.find(k => k === url.searchParams.get("kind"));
  return {
    siteKey: context.get(appEnvContext).TURNSTILE_SITE_KEY,
    sent: url.searchParams.get("sent") === "1",
    values: {
      kind: kind ?? "general",
      name: "",
      email: "",
      url: url.searchParams.get("url") ?? "",
      message: "",
    } satisfies Values,
  };
}

export async function action({ request, context }: ActionFunctionArgs) {
  assertSameOrigin(request);
  const form = await request.formData().catch(() => null);
  const text = (name: string) => String(form?.get(name) ?? "");
  const values: Values = {
    kind: KINDS.find(k => k === text("kind")) ?? "general",
    name: text("name"),
    email: text("email"),
    url: text("url"),
    message: text("message"),
  };
  const answer = (
    outcome: {
      readonly message?: string;
      readonly fields?: Partial<Record<FieldName, string>>;
    },
    init: ResponseInit
  ) => data({ values, message: null, fields: {}, ...outcome }, init);

  const parsed = contactForm.safeParse({
    ...values,
    turnstile_token: text("cf-turnstile-response"),
  });
  if (!parsed.success) {
    // Each field's first problem: later ones are laid under it.
    const fields: Partial<Record<FieldName, string>> = Object.fromEntries(
      parsed.error.issues
        .filter(
          ({ path: [name] }) => typeof name === "string" && name in FIELD_LABELS
        )
        .map(({ path: [name], message }) => [name, message])
        .reverse()
    );
    return answer(
      Object.keys(fields).length > 0 ? { fields } : { message: NO_TOKEN },
      { status: 400 }
    );
  }
  const result = await createContactRequest(request, context, parsed.data);
  if (!result.ok) {
    return answer(
      { message: result.error.message },
      { status: result.status, headers: result.headers }
    );
  }
  return redirect(`${CONTACT_FORM_URL}?sent=1`, {
    status: 303,
    headers: result.headers,
  });
}

export default function ContactRoute() {
  const loaded = useLoaderData<typeof loader>();
  const failed = useActionData<typeof action>();
  const values = failed?.values ?? loaded.values;
  const fields: Partial<Record<FieldName, string>> = failed?.fields ?? {};
  const [first, ...more] = (Object.keys(FIELD_LABELS) as FieldName[])
    .filter(name => fields[name] !== undefined)
    .map(name => ({
      fieldId: fieldId(name),
      message: `${FIELD_LABELS[name]}: ${fields[name] ?? ""}`,
    }));
  return (
    <div className="max-w-form stack-y-6">
      <h1 className="text-h1 text-fg">Contact us</h1>
      <p className="text-body text-fg">
        Write to the moderators to ask for a link or a page about you to be
        taken down, to opt out of the site, to send a correction, or to report a
        link. You don’t need an account. We use your email address only to
        reply. See the{" "}
        <Link to={helpHref("faq-for-bards")} appearance="prose">
          FAQ for bards
        </Link>{" "}
        for what we can and can’t remove.
      </p>
      {loaded.sent && !failed ? (
        <Alert
          tone="success"
          title="Thank you. Your message is with the moderators."
        >
          They will reply by email if they need to.
        </Alert>
      ) : null}
      {first ? <ErrorSummary problems={[first, ...more]} /> : null}
      {failed?.message ? (
        <Alert tone="danger" title="We couldn’t send your message.">
          {failed.message}
        </Alert>
      ) : null}
      <Form method="post" reloadDocument className="grid gap-5">
        <Field label="What it’s about" id="contact-kind">
          <Select name="kind" defaultValue={values.kind}>
            {KINDS.map(kind => (
              <option key={kind} value={kind}>
                {CONTACT_KIND_LABELS[kind]}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label={FIELD_LABELS.name}
          id={fieldId("name")}
          error={fields.name}
          optional
        >
          <Input name="name" defaultValue={values.name} autoComplete="name" />
        </Field>
        <Field
          label={FIELD_LABELS.email}
          id={fieldId("email")}
          error={fields.email}
        >
          <Input
            name="email"
            type="email"
            defaultValue={values.email}
            autoComplete="email"
            required
          />
        </Field>
        <Field
          label={FIELD_LABELS.url}
          id={fieldId("url")}
          help="The page on this site, or the link, if it’s about one."
          error={fields.url}
          optional
        >
          <Input name="url" type="url" defaultValue={values.url} />
        </Field>
        <Field
          label={FIELD_LABELS.message}
          id={fieldId("message")}
          error={fields.message}
        >
          <Textarea
            name="message"
            defaultValue={values.message}
            maxLength={5000}
            required
          />
        </Field>
        <div>
          <Turnstile siteKey={loaded.siteKey} />
          <noscript>
            <p className="text-body-sm text-fg-muted">
              This form checks that you’re not a robot, which needs JavaScript.
            </p>
          </noscript>
        </div>
        <Button type="submit" variant="primary" icon={IconSend}>
          Send
        </Button>
      </Form>
    </div>
  );
}
