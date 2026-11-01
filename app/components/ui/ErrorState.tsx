import { useLocation, useRevalidator } from "@remix-run/react";
import { IconRefresh } from "@tabler/icons-react";
import { useEffect, useRef, type ReactNode } from "react";
import { UnlitMark } from "~/components/LogoMark";
import { useHydrated } from "~/hooks/useHydrated";
import { Alert } from "./Alert";
import { Button, ButtonLink } from "./Button";

/**
 * "Try again" for something that failed to load (DESIGN §6.16). With JS it
 * re-runs the page's loaders in place (busy while they run), which also
 * clears an error boundary once they succeed. Without JS, and before
 * hydration, it is a link that loads the same address again.
 */
export function TryAgain({
  variant = "secondary",
  size = "md",
}: {
  readonly variant?: "primary" | "secondary";
  readonly size?: "sm" | "md";
}) {
  const hydrated = useHydrated();
  const revalidator = useRevalidator();
  const { pathname, search } = useLocation();
  if (!hydrated) {
    return (
      <ButtonLink
        to={`${pathname}${search}`}
        reloadDocument
        variant={variant}
        size={size}
        icon={IconRefresh}
      >
        Try again
      </ButtonLink>
    );
  }
  return (
    <Button
      variant={variant}
      size={size}
      icon={IconRefresh}
      loading={revalidator.state === "loading"}
      onClick={() => revalidator.revalidate()}
    >
      Try again
    </Button>
  );
}

/**
 * A part of the page that failed to load (DESIGN §6.16, §7.3): a danger
 * Alert with a short title, the cause if known and a small "Try again". The
 * rest of the page stays usable.
 */
export function SectionError({
  title,
  children,
}: {
  readonly title: string;
  /** The cause, in plain words, when it is known. */
  readonly children?: ReactNode;
}) {
  return (
    <Alert tone="danger" title={title} actions={<TryAgain size="sm" />}>
      {children}
    </Alert>
  );
}

/**
 * The body of an error page (DESIGN §6.16, §10.4, §10.5): the unlit torch,
 * an h1, what happened and what to do, an optional reference and the
 * actions. Never a stack trace, status text or JSON. When it replaces a
 * page after a client-side navigation, focus moves to the heading, so the
 * change is announced; a server-rendered error page leaves focus alone.
 */
export function ErrorState({
  title,
  children,
  reference,
  actions,
  art = "broken",
}: {
  readonly title: string;
  readonly children: ReactNode;
  /** The Sentry event id, when Sentry is configured; omitted otherwise. */
  readonly reference?: string | undefined;
  /** Buttons and links: e.g. TryAgain and "Go to the home page". */
  readonly actions: ReactNode;
  /** `missing` (404): the plain unlit torch; `broken`: its flame dashed. */
  readonly art?: "missing" | "broken";
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  // True on the first render only when mounted after hydration, i.e. the
  // error happened during a client-side navigation.
  const mountedOnClient = useRef(useHydrated());

  useEffect(() => {
    if (mountedOnClient.current) heading.current?.focus();
  }, []);

  return (
    <div className="flex max-w-prose flex-col items-start py-8 md:py-12">
      <UnlitMark size={64} dashed={art === "broken"} />
      <h1
        ref={heading}
        tabIndex={-1}
        className="mt-6 text-h1 text-fg focus-visible:outline-none"
      >
        {title}
      </h1>
      <div className="mt-3 text-body-lg text-fg-muted">{children}</div>
      {reference ? (
        <p className="mt-4 font-mono text-caption text-fg-subtle">
          Reference: {reference}
        </p>
      ) : null}
      <div className="mt-8 flex flex-wrap items-center gap-3">{actions}</div>
    </div>
  );
}
