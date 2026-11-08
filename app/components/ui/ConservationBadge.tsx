import {
  IconAlertOctagon,
  IconAlertTriangle,
  IconCircleDashed,
  IconLock,
  IconShieldCheck,
  type Icon,
} from "@tabler/icons-react";
import { Link as RouterLink } from "react-router";
import {
  CONSERVATION_LABELS,
  conservationHelpPath,
  type ConservationStatus,
} from "~/constants/vocabulary";

/**
 * Each status's look (DESIGN §2.5): its icon, and full class strings so
 * Tailwind sees every one. The border token colours the icon too. The two
 * extremes differ by more than colour: critically endangered has a 2 px
 * border, unassessed a dashed one.
 */
const STATUSES: Readonly<
  Record<
    ConservationStatus,
    { readonly box: string; readonly iconColour: string; readonly icon: Icon }
  >
> = {
  low_risk: {
    box: "border border-cons-low-border bg-cons-low-bg text-cons-low-fg",
    iconColour: "text-cons-low-border",
    icon: IconShieldCheck,
  },
  endangered: {
    box: "border border-cons-end-border bg-cons-end-bg text-cons-end-fg",
    iconColour: "text-cons-end-border",
    icon: IconAlertTriangle,
  },
  critically_endangered: {
    box: "border-2 border-cons-crit-border bg-cons-crit-bg text-cons-crit-fg",
    iconColour: "text-cons-crit-border",
    icon: IconAlertOctagon,
  },
  restricted: {
    box: "border border-cons-res-border bg-cons-res-bg text-cons-res-fg",
    iconColour: "text-cons-res-border",
    icon: IconLock,
  },
  unassessed: {
    box: "border border-dashed border-cons-un-border bg-cons-un-bg text-cons-un-fg",
    iconColour: "text-cons-un-border",
    icon: IconCircleDashed,
  },
};

const SIZES = {
  sm: { box: "min-h-6 gap-1 px-2 text-caption", icon: 14 },
  md: { box: "min-h-7 gap-1.5 px-2.5 text-body-sm font-medium", icon: 16 },
} as const;

const PILL =
  "inline-flex max-w-full items-center whitespace-nowrap rounded-full align-middle";

/**
 * A piece's conservation status (DESIGN §6.13): a pill with the status's
 * icon and label, never colour alone. Static by default; as a `link` it
 * goes to the status's entry on the conservation help page, named
 * "Conservation status: Endangered". A static badge has the same hidden
 * prefix unless its context already says what it is (`named`: the
 * infobox's "Conservation" row).
 */
export function ConservationBadge({
  status,
  size = "md",
  link = false,
  named = false,
}: {
  readonly status: ConservationStatus;
  /** `sm` (24 px) in lists and cards, `md` (28 px) in page heads. */
  readonly size?: keyof typeof SIZES;
  /** Link to the status's entry, `/help/conservation-status#{status}`. */
  readonly link?: boolean;
  /** The context already names it, so the hidden prefix is left out. */
  readonly named?: boolean;
}) {
  const { box, iconColour, icon: StatusIcon } = STATUSES[status];
  const { box: sizing, icon: iconSize } = SIZES[size];
  const className = `${PILL} ${sizing} ${box}`;
  const content = (
    <>
      <StatusIcon
        size={iconSize}
        stroke={1.75}
        aria-hidden="true"
        className={`shrink-0 ${iconColour}`}
      />
      <span
        className={
          link ? "underline-offset-prose group-hover:underline" : undefined
        }
      >
        {link || !named ? (
          <span className="sr-only">Conservation status: </span>
        ) : null}
        {CONSERVATION_LABELS[status]}
      </span>
    </>
  );
  if (link) {
    return (
      <RouterLink
        to={conservationHelpPath(status)}
        prefetch="intent"
        className={`group ${className}`}
      >
        {content}
      </RouterLink>
    );
  }
  return <span className={className}>{content}</span>;
}
