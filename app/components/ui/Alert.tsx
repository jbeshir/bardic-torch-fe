import {
  IconAlertCircle,
  IconAlertTriangle,
  IconCircleCheck,
  IconHourglass,
  IconInfoCircle,
  type Icon,
} from "@tabler/icons-react";
import type { ReactNode } from "react";

export type AlertTone = "info" | "success" | "warning" | "danger" | "pending";

/** Each tone's icon shape (DESIGN §6.14), shared with Toast. */
export const TONE_GLYPHS: Record<AlertTone, Icon> = {
  info: IconInfoCircle,
  success: IconCircleCheck,
  warning: IconAlertTriangle,
  danger: IconAlertCircle,
  pending: IconHourglass,
};

/** Each tone's hidden name, read before the words. */
export const TONE_NAMES: Record<AlertTone, string> = {
  info: "Information",
  success: "Success",
  warning: "Warning",
  danger: "Error",
  pending: "Pending approval",
};

/** Full class strings per tone, so Tailwind can see every one of them. */
const TONES: Record<AlertTone, { box: string; icon: string }> = {
  info: {
    box: "border-info-border bg-info-bg text-info-fg",
    icon: "text-info-icon",
  },
  success: {
    box: "border-success-border bg-success-bg text-success-fg",
    icon: "text-success-icon",
  },
  warning: {
    box: "border-warning-border bg-warning-bg text-warning-fg",
    icon: "text-warning-icon",
  },
  danger: {
    box: "border-danger-border bg-danger-bg text-danger-fg",
    icon: "text-danger-icon",
  },
  pending: {
    box: "border-pending-border bg-pending-bg text-pending-fg",
    icon: "text-pending-icon",
  },
};

/**
 * A status message (DESIGN §6.14): icon, title, body and actions on the
 * tone's tinted background. Every tone has its own icon shape and a hidden
 * "Warning: " (etc.) before the words, so state never rests on colour.
 *
 * Rendered with the page, an alert is not a live region. To announce one
 * that appears after an action, render it inside an AlertRegion. A `banner`
 * is the page-level form under the tab row: full-bleed below md.
 */
export function Alert({
  tone,
  title,
  children,
  actions,
  banner = false,
  icon,
  headingLevel,
}: {
  readonly tone: AlertTone;
  readonly title?: ReactNode;
  readonly children?: ReactNode;
  /** Buttons or links under the body. */
  readonly actions?: ReactNode;
  readonly banner?: boolean;
  /** Replaces the tone's icon, e.g. a lock for the restricted banner. */
  readonly icon?: Icon;
  /** Makes the title a heading, for alerts that head a form or section. */
  readonly headingLevel?: 2 | 3;
}) {
  const { box, icon: iconColour } = TONES[tone];
  const Glyph = icon ?? TONE_GLYPHS[tone];
  const Title = headingLevel === 2 ? "h2" : headingLevel === 3 ? "h3" : "p";
  const toneName = <span className="sr-only">{TONE_NAMES[tone]}: </span>;
  const shape = banner
    ? "rounded-none border-x-0 border-y md:rounded-lg md:border-x"
    : "rounded-lg border";
  return (
    <div className={`flex gap-3 p-4 ${shape} ${box}`}>
      <Glyph
        size={20}
        stroke={1.75}
        aria-hidden="true"
        className={`mt-0.5 shrink-0 ${iconColour}`}
      />
      <div className="min-w-0 flex-1">
        {title ? (
          <Title className="font-sans text-body font-semibold">
            {toneName}
            {title}
          </Title>
        ) : null}
        {children ? (
          <div className={`text-body-sm${title ? " mt-1" : ""}`}>
            {title ? null : toneName}
            {children}
          </div>
        ) : null}
        {actions ? (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * A live region for alerts that appear after an action (DESIGN §6.14). It is
 * always mounted (empty at first), so adding an Alert inside is announced:
 * politely by default (info, success, pending), at once when `urgent`
 * (errors, and warnings that block).
 */
export function AlertRegion({
  urgent = false,
  children,
}: {
  readonly urgent?: boolean;
  readonly children?: ReactNode;
}) {
  return urgent ? (
    <div role="alert">{children}</div>
  ) : (
    <div role="status">{children}</div>
  );
}
