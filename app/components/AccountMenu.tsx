import { Form, Link as RouterLink, useLocation } from "react-router";
import {
  IconChevronDown,
  IconGitPullRequest,
  IconLogin,
  IconLogout,
  IconSettings,
  IconShieldCheck,
  IconUserOff,
  IconUserQuestion,
} from "@tabler/icons-react";
import { useId, useRef, useState } from "react";
import { Alert } from "~/components/ui/Alert";
import { ButtonLink } from "~/components/ui/Button";
import { TryAgain } from "~/components/ui/ErrorState";
import {
  LOGOUT_ACTION,
  ROLE_LABELS,
  CONTRIBUTIONS_PATH,
  loginHref,
  SETTINGS_PATH,
  type Account,
} from "~/constants/account";
import { MODERATION_PATH } from "~/constants/moderation";
import { useDismiss } from "~/hooks/useDismiss";

type Placement = "header" | "bar";

/** Up to two initials, from the capitalised words of a display name. */
function initialsOf(name: string): string {
  const words = name.split(/\s+/).filter(word => /^\p{Lu}/u.test(word));
  const picked = (words.length > 0 ? words : [name]).slice(0, 2);
  return picked.map(word => [...word][0] ?? "").join("");
}

/**
 * The trigger's disc: the initials when the name is known; otherwise a
 * glyph that tells the two other states apart: a person with
 * a question mark when the profile couldn't load, a struck-out person when
 * the account is blocked. A `border-strong` edge keeps the disc visible on
 * the light canvas and the bar's sunken cell.
 */
function Avatar({
  account,
  size,
}: {
  readonly account: Exclude<Account, { state: "signed-out" }>;
  readonly size: 24 | 32;
}) {
  const glyph = size === 32 ? 18 : 14;
  return (
    <span
      aria-hidden="true"
      data-state={account.state}
      className={`inline-flex shrink-0 items-center justify-center rounded-full border border-border-strong bg-accent-subtle font-display font-semibold text-accent-text ${size === 32 ? "h-8 w-8 text-body-sm" : "h-6 w-6 text-caption"}`}
    >
      {account.state === "signed-in" ? (
        initialsOf(account.user.display_name)
      ) : account.state === "blocked" ? (
        <IconUserOff size={glyph} stroke={1.75} />
      ) : (
        <IconUserQuestion size={glyph} stroke={1.75} />
      )}
    </span>
  );
}

/** A bottom-bar cell: a 24 px icon above its visible caption. */
export const BAR_CELL =
  "flex h-full min-h-11 w-full flex-col items-center justify-center gap-0.5 text-caption text-fg-muted transition-colors hover:bg-surface-sunken hover:text-fg focus-visible:-outline-offset-2 forced-colors:border-0";

const ROW =
  "flex min-h-11 w-full items-center gap-2 rounded-md px-3 text-left text-body-sm text-fg transition-colors hover:bg-surface-sunken focus-visible:-outline-offset-2 lg:min-h-10";

function AccountPanel({
  account,
}: {
  readonly account: Exclude<Account, { state: "signed-out" }>;
}) {
  return (
    <div className="stack-y-1">
      {account.state === "signed-in" ? (
        <div className="px-3 py-2">
          <p className="text-body font-semibold text-fg">
            {account.user.display_name}
          </p>
          <p className="text-caption text-fg-muted">
            {ROLE_LABELS[account.user.role]}
          </p>
        </div>
      ) : null}
      {account.state === "profile-unavailable" ? (
        <Alert tone="warning" actions={<TryAgain size="sm" />}>
          We couldn’t load your profile.
        </Alert>
      ) : null}
      {account.state === "blocked" ? (
        <Alert tone="danger">{account.message}</Alert>
      ) : null}
      {account.state === "blocked" ? null : (
        <>
          <RouterLink to={CONTRIBUTIONS_PATH} prefetch="intent" className={ROW}>
            <IconGitPullRequest
              size={18}
              stroke={1.75}
              aria-hidden="true"
              className="text-fg-muted"
            />
            My contributions
          </RouterLink>
          {account.state === "signed-in" &&
          account.user.role === "moderator" ? (
            <RouterLink to={MODERATION_PATH} prefetch="intent" className={ROW}>
              <IconShieldCheck
                size={18}
                stroke={1.75}
                aria-hidden="true"
                className="text-fg-muted"
              />
              Moderation
            </RouterLink>
          ) : null}
          <RouterLink to={SETTINGS_PATH} prefetch="intent" className={ROW}>
            <IconSettings
              size={18}
              stroke={1.75}
              aria-hidden="true"
              className="text-fg-muted"
            />
            Settings
          </RouterLink>
        </>
      )}
      <div className="border-t border-border pt-1">
        {/* A real form post: logging out leaves for Auth0. */}
        <Form method="post" action={LOGOUT_ACTION} reloadDocument>
          <button type="submit" className={ROW}>
            <IconLogout
              size={18}
              stroke={1.75}
              aria-hidden="true"
              className="text-fg-muted"
            />
            Log out
          </button>
        </Form>
      </div>
    </div>
  );
}

/**
 * The account control, in the header from md and as the
 * bottom bar's Account cell below. Signed out it is a "Log in" link that
 * comes back here. Signed in it is a disclosure (not an ARIA menu) built on
 * `<details>`, so it opens without JS; with JS, Escape, a press or focus
 * outside, and navigating close it. When the profile couldn't load the
 * trigger reads "Account" and the panel says so, with "Try again"; a
 * blocked account gets its message and "Log out".
 */
export function AccountMenu({
  account,
  placement,
}: {
  readonly account: Account;
  readonly placement: Placement;
}) {
  const { pathname, search } = useLocation();
  const panelId = useId();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);

  useDismiss({
    open,
    close: returnFocus => {
      if (detailsRef.current) detailsRef.current.open = false;
      if (returnFocus) summaryRef.current?.focus();
    },
    areas: [detailsRef],
  });

  if (account.state === "signed-out") {
    const href = loginHref(`${pathname}${search}`);
    if (placement === "header") {
      return (
        <ButtonLink to={href} reloadDocument size="sm" icon={IconLogin}>
          Log in
        </ButtonLink>
      );
    }
    return (
      <a href={href} className={BAR_CELL}>
        <IconLogin size={24} stroke={1.75} aria-hidden="true" />
        Log in
      </a>
    );
  }

  const name = account.state === "signed-in" ? account.user.display_name : null;
  const accessibleName = name ? `: ${name}` : "";

  return (
    <details
      ref={detailsRef}
      onToggle={() => setOpen(detailsRef.current?.open ?? false)}
      className={placement === "header" ? "relative" : "relative h-full"}
    >
      <summary
        ref={summaryRef}
        aria-controls={panelId}
        className={
          placement === "header"
            ? "summary-plain inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-full px-1 text-fg-muted transition-colors hover:text-fg forced-colors:border"
            : `summary-plain cursor-pointer ${BAR_CELL}`
        }
      >
        {placement === "header" ? (
          <>
            <Avatar account={account} size={32} />
            <IconChevronDown size={14} stroke={1.75} aria-hidden="true" />
            <span className="sr-only">Account{accessibleName}</span>
          </>
        ) : (
          <>
            <Avatar account={account} size={24} />
            <span>
              Account<span className="sr-only">{accessibleName}</span>
            </span>
          </>
        )}
      </summary>
      <div
        id={panelId}
        className={`absolute z-header w-64 rounded-lg border border-border bg-surface-raised p-2 text-fg shadow-2 ${placement === "header" ? "right-0 top-full mt-2" : "bottom-full right-2 mb-2"}`}
      >
        <AccountPanel account={account} />
      </div>
    </details>
  );
}
