import { Link as RemixLink } from "@remix-run/react";
import type { Icon } from "@tabler/icons-react";
import type { ButtonHTMLAttributes, MouseEvent, ReactNode, Ref } from "react";
import { forwardRef } from "react";
import { ExternalMark, externalKind, type ExternalKind } from "./Link";
import { Spinner } from "./Spinner";

type Variant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "secondary-danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "border border-transparent bg-accent text-accent-fg shadow-1 hover:bg-accent-hover active:bg-accent-hover",
  secondary:
    "border border-border-strong bg-surface-raised text-fg hover:bg-surface-sunken active:bg-surface-sunken",
  ghost:
    "border border-transparent bg-transparent text-fg-muted hover:bg-surface-sunken hover:text-fg active:bg-surface-sunken active:text-fg",
  danger:
    "border border-transparent bg-danger text-danger-on hover:bg-danger-hover active:bg-danger-hover",
  "secondary-danger":
    "border border-danger-icon bg-surface-raised text-danger-fg hover:bg-danger-bg active:bg-danger-bg",
};

const SIZES: Record<Size, { box: string; square: string; icon: number }> = {
  // 36 px tall; below lg a ::before pads the hit area to 44 px.
  sm: {
    box: "min-h-9 gap-1.5 px-3 text-body-sm font-medium before:absolute before:-inset-1 lg:before:hidden",
    square: "min-h-9 w-9 before:absolute before:-inset-1 lg:before:hidden",
    icon: 16,
  },
  md: {
    box: "min-h-11 gap-2 px-4 text-body font-medium",
    square: "min-h-11 w-11",
    icon: 18,
  },
  lg: {
    box: "min-h-13 gap-2 px-5 text-body font-semibold",
    square: "min-h-13 w-13",
    icon: 20,
  },
};

const BASE =
  "relative inline-flex shrink-0 select-none items-center justify-center rounded-md text-center transition-colors motion-safe:active:translate-y-px";

/** Toggle buttons (`aria-pressed`), disabled and busy, for every variant. */
const STATES =
  "aria-pressed:border-border-strong aria-pressed:bg-accent-subtle aria-pressed:text-accent-text " +
  "disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-sunken disabled:text-fg-subtle disabled:shadow-none " +
  "aria-busy:cursor-progress";

type Look = {
  variant?: Variant | undefined;
  size?: Size | undefined;
  /** Stretch to the container's width (mobile form submits, sheets). */
  fullWidth?: boolean | undefined;
  /** Trailing icon, decorative (e.g. a chevron or an arrow). */
  trailingIcon?: Icon | undefined;
};

/**
 * Destructive buttons always carry an icon as well as a verb (DESIGN §2.4);
 * icon-only buttons need a label; a busy button swaps its leading icon for
 * the spinner, so it must have one and never changes width.
 */
type Content =
  | {
      variant?: Exclude<Variant, "danger" | "secondary-danger">;
      icon?: Icon;
      children: ReactNode;
      label?: never;
    }
  | {
      variant: "danger" | "secondary-danger";
      icon: Icon;
      children: ReactNode;
      label?: never;
    }
  | {
      /** Icon-only: the accessible name (`aria-label`); no visible text. */
      label: string;
      icon: Icon;
      children?: never;
    };

type Busy = { loading?: never } | { loading: boolean; icon: Icon };

function classes(
  { variant = "secondary", size = "md", fullWidth }: Look,
  iconOnly: boolean
) {
  const dimensions = iconOnly ? SIZES[size].square : SIZES[size].box;
  return `${BASE} ${VARIANTS[variant]} ${dimensions} ${STATES}${fullWidth ? " w-full" : ""}`;
}

function Inside({
  icon: LeadingIcon,
  trailingIcon: TrailingIcon,
  size = "md",
  loading,
  children,
}: {
  icon?: Icon | undefined;
  trailingIcon?: Icon | undefined;
  size?: Size | undefined;
  loading?: boolean;
  children?: ReactNode;
}) {
  const iconSize = SIZES[size].icon;
  return (
    <>
      {LeadingIcon ? (
        // Icon and spinner share one cell, so the width never changes.
        <span className="grid shrink-0 place-items-center">
          <LeadingIcon
            size={iconSize}
            stroke={1.75}
            aria-hidden="true"
            className={`col-start-1 row-start-1${loading ? " invisible" : ""}`}
          />
          {loading ? (
            <span className="col-start-1 row-start-1 inline-flex">
              <Spinner tone="inherit" />
            </span>
          ) : null}
        </span>
      ) : null}
      {children}
      {TrailingIcon ? (
        <TrailingIcon
          size={iconSize}
          stroke={1.75}
          aria-hidden="true"
          className="shrink-0"
        />
      ) : null}
    </>
  );
}

type ButtonProps = Look &
  Content &
  Busy &
  Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    "className" | "style" | "children" | "aria-label"
  >;

/**
 * DESIGN §6.2. A real `<button>` (type "button" unless you say "submit").
 * While `loading` it stays focusable but is `aria-disabled` and ignores
 * clicks, so a repeat submit can't happen; announce "Saving…" from the
 * form's own status region, not from here.
 */
export const Button = forwardRef(function Button(
  {
    variant,
    size,
    fullWidth,
    icon,
    trailingIcon,
    label,
    loading = false,
    children,
    type = "button",
    onClick,
    ...rest
  }: ButtonProps,
  ref: Ref<HTMLButtonElement>
) {
  function guardWhileBusy(event: MouseEvent<HTMLButtonElement>) {
    if (loading) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  }

  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      aria-label={label}
      aria-busy={loading || undefined}
      aria-disabled={loading || rest["aria-disabled"] || undefined}
      onClick={guardWhileBusy}
      className={classes({ variant, size, fullWidth }, label !== undefined)}
    >
      <Inside
        icon={icon}
        trailingIcon={trailingIcon}
        size={size}
        loading={loading}
      >
        {children}
      </Inside>
    </button>
  );
});

type ButtonLinkProps = Look &
  Content & {
    /** An internal path (through Remix), or an absolute URL (external). */
    to: string;
    /** For an absolute URL: where it goes, for the hidden suffix. */
    external?: ExternalKind;
    /**
     * Load the page from the server instead of navigating in the app: the
     * no-JS "Try again", which must work when the app itself failed.
     */
    reloadDocument?: boolean;
  };

/**
 * A link that looks like a Button, for actions that navigate (DESIGN §6.2):
 * "Go to the home page", "Start contributing". It has no disabled or busy
 * state; a link that can't be followed is plain text instead.
 */
export function ButtonLink({
  variant,
  size,
  fullWidth,
  icon,
  trailingIcon,
  label,
  children,
  to,
  external,
  reloadDocument = false,
}: ButtonLinkProps) {
  const className = classes({ variant, size, fullWidth }, label !== undefined);
  const kind = externalKind(to, external);
  if (kind) {
    return (
      <a href={to} rel="noopener" aria-label={label} className={className}>
        <Inside icon={icon} size={size}>
          {children}
        </Inside>
        <ExternalMark kind={kind} size={SIZES[size ?? "md"].icon} />
      </a>
    );
  }
  return (
    <RemixLink
      to={to}
      prefetch={reloadDocument ? "none" : "intent"}
      reloadDocument={reloadDocument}
      aria-label={label}
      className={className}
    >
      <Inside icon={icon} trailingIcon={trailingIcon} size={size}>
        {children}
      </Inside>
    </RemixLink>
  );
}
