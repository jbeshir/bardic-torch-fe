import { IconPlus } from "@tabler/icons-react";
import { useState } from "react";
import { Alert, AlertRegion, type AlertTone } from "~/components/ui/Alert";
import { Button, ButtonLink } from "~/components/ui/Button";
import { EmptyState } from "~/components/ui/EmptyState";
import { ErrorState, SectionError, TryAgain } from "~/components/ui/ErrorState";
import { Link } from "~/components/ui/Link";
import { Skeleton, SkeletonRegion } from "~/components/ui/Skeleton";
import { Spinner } from "~/components/ui/Spinner";
import { useToast } from "~/components/ui/Toast";
import { wikiSearchUrl } from "~/constants/navigation";
import { Example, Specimen } from "./Specimen";

const ALERTS: readonly {
  readonly tone: AlertTone;
  readonly title: string;
  readonly body: string;
}[] = [
  {
    tone: "info",
    title: "This page is a stub",
    body: "It has the basics. Help fill in the rest.",
  },
  {
    tone: "success",
    title: "Display name saved",
    body: "It now shows on your edits.",
  },
  {
    tone: "warning",
    title: "This link may be broken",
    body: "It didn't answer the last time we checked.",
  },
  {
    tone: "danger",
    title: "We couldn't save your changes",
    body: "Check your connection and try again.",
  },
  {
    tone: "pending",
    title: "Waiting for approval",
    body: "A moderator will look at your edit soon.",
  },
];

/** An alert that appears after an action, inside a live region. */
function LiveAlertDemo() {
  const [shown, setShown] = useState(false);
  return (
    <div className="grid w-full gap-3">
      <div>
        <Button onClick={() => setShown(!shown)}>
          {shown ? "Hide the saved message" : "Show the saved message"}
        </Button>
      </div>
      <AlertRegion>
        {shown ? (
          <Alert tone="success" title="Display name saved">
            It now shows on your edits.
          </Alert>
        ) : null}
      </AlertRegion>
    </div>
  );
}

export function Alerts() {
  return (
    <Specimen
      id="alert"
      title="Alert and Banner"
      summary="Status messages in five tones, each with its own icon and a hidden tone name (DESIGN §6.14). Banners are styleguide-only in FE1."
    >
      <Example label="Tones" stack>
        {ALERTS.map(({ tone, title, body }) => (
          <Alert key={tone} tone={tone} title={title}>
            {body}
          </Alert>
        ))}
      </Example>
      <Example label="Body only, and with actions and a link" stack>
        <Alert tone="warning">Changing your settings needs JavaScript.</Alert>
        <Alert
          tone="danger"
          title="We couldn't load your profile"
          actions={
            <>
              <TryAgain size="sm" />
              <Link to="/help" appearance="inherit">
                Get help
              </Link>
            </>
          }
        >
          The account service didn&apos;t answer.
        </Alert>
      </Example>
      <Example label="Banner (full-bleed below md)" wide>
        <div className="w-full">
          <Alert tone="pending" banner title="Waiting for approval">
            Your edit will appear once a moderator has looked at it.
          </Alert>
        </div>
      </Example>
      <Example label="After an action (announced politely)" wide>
        <LiveAlertDemo />
      </Example>
    </Specimen>
  );
}

export function EmptyStates() {
  return (
    <Specimen
      id="empty-state"
      title="Empty state"
      summary="Nothing here yet: why, and what to do (DESIGN §6.15)."
    >
      <Example label="No API tokens" wide>
        <div className="w-full rounded-lg border border-border bg-surface">
          <EmptyState
            title="No tokens yet"
            action={
              <Button variant="primary" icon={IconPlus}>
                Create token
              </Button>
            }
          >
            Create a token to let tools like an MCP client work with Bardic
            Torch for you.
          </EmptyState>
        </div>
      </Example>
    </Specimen>
  );
}

export function ErrorStates() {
  return (
    <Specimen
      id="error-state"
      title="Error state"
      summary="A region that failed, and the body of the 404 and error pages (DESIGN §6.16, §10.4, §10.5). On a real page the heading is the page's h1."
    >
      <Example label="Section failed to load" stack>
        <SectionError title="We couldn't load your profile">
          The account service didn&apos;t answer. Everything else still works.
        </SectionError>
      </Example>
      <Example label="Page not found" wide>
        <div className="w-full rounded-lg border border-border bg-surface px-4 md:px-8">
          <ErrorState
            title="We couldn't find that page"
            art="missing"
            actions={
              <>
                <ButtonLink to="/" variant="primary">
                  Go to the home page
                </ButtonLink>
                <Link to={wikiSearchUrl("styleguide")} external="wiki">
                  Look on the original wiki
                </Link>
              </>
            }
          >
            It may have moved, or the link may be mistyped. Bardic Torch is new,
            so pages from the old wiki don&apos;t redirect here yet.
          </ErrorState>
        </div>
      </Example>
      <Example label="Something went wrong, with a reference" wide>
        <div className="w-full rounded-lg border border-border bg-surface px-4 md:px-8">
          <ErrorState
            title="Something went wrong"
            reference="7f3a2c9e41d04b8a"
            actions={
              <>
                <TryAgain variant="primary" />
                <ButtonLink to="/">Go to the home page</ButtonLink>
              </>
            }
          >
            That&apos;s on us, not you. Try again in a moment. If it keeps
            happening, let us know and include the reference below.
          </ErrorState>
        </div>
      </Example>
    </Specimen>
  );
}

export function Loading() {
  return (
    <Specimen
      id="loading"
      title="Spinner and Skeleton"
      summary="Spinners for short actions, skeletons for regions on client transitions (DESIGN §6.17, §6.18, §7.1). Both still under reduced motion: the arc pulses, the shimmer stops."
    >
      <Example label="Spinner at 16, 20 and 24 px">
        <span
          role="status"
          className="flex items-center gap-3 text-body-sm text-fg-muted"
        >
          <Spinner />
          <Spinner size={20} />
          <Spinner size={24} />
          Loading…
        </span>
      </Example>
      <Example label="Skeleton: heading, lines and chips" wide>
        <div className="w-full max-w-prose">
          <SkeletonRegion label="the page">
            <div className="grid gap-3">
              <Skeleton shape="heading" />
              <p className="text-body">
                <Skeleton />
                <Skeleton width="most" />
                <Skeleton width="part" />
              </p>
              <div className="flex gap-2">
                <Skeleton shape="chip" />
                <Skeleton shape="chip" />
              </div>
            </div>
          </SkeletonRegion>
        </div>
      </Example>
    </Specimen>
  );
}

export function Toasts() {
  const show = useToast();
  return (
    <Specimen
      id="toast"
      title="Toast"
      summary="Brief feedback after an action, never the only copy of it (DESIGN §6.23). Success and info leave after 6 s (paused while you point at or focus them); errors stay. No actions."
    >
      <Example label="Raise one">
        <Button
          onClick={() =>
            show({ tone: "success", message: "Display name saved." })
          }
        >
          Show a success toast
        </Button>
        <Button
          onClick={() =>
            show({
              tone: "info",
              message: "Copied the token to the clipboard.",
            })
          }
        >
          Show an info toast
        </Button>
        <Button
          onClick={() =>
            show({
              tone: "danger",
              message:
                "You seem to be offline. Your changes haven't been saved yet.",
            })
          }
        >
          Show an error toast
        </Button>
      </Example>
    </Specimen>
  );
}
