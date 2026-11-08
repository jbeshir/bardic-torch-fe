import { useLocation, useRevalidator } from "react-router";
import { IconRefresh } from "@tabler/icons-react";
import { createContext, use, useEffect, useRef, type ReactNode } from "react";
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

/** Whether an error state is under a page head that already has the h1. */
const UnderHeadContext = createContext(false);
UnderHeadContext.displayName = "UnderHeadContext";

/**
 * Wraps the error a child route shows under its layout's head (a category's
 * members, a history): its heading is an h2, so the page keeps its one h1.
 * An error that replaces the whole page keeps the h1.
 */
export function UnderPageHead({ children }: { readonly children: ReactNode }) {
  return <UnderHeadContext value={true}>{children}</UnderHeadContext>;
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
  const underHead = use(UnderHeadContext);
  const Heading = underHead ? "h2" : "h1";
  const headingRef = useRef<HTMLHeadingElement>(null);
  // True on the first render only when mounted after hydration, i.e. the
  // error happened during a client-side navigation.
  const mountedOnClientRef = useRef(useHydrated());

  useEffect(() => {
    if (mountedOnClientRef.current) headingRef.current?.focus();
  }, []);

  return (
    <div className="flex max-w-prose flex-col items-start py-8 md:py-12">
      <UnlitMark size={64} dashed={art === "broken"} />
      <Heading
        ref={headingRef}
        tabIndex={-1}
        className={`mt-6 ${underHead ? "text-h2" : "text-h1"} text-fg focus-visible:outline-hidden`}
      >
        {title}
      </Heading>
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
