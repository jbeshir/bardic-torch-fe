import { Form, useLocation } from "@remix-run/react";
import {
  IconDeviceDesktop,
  IconMoon,
  IconSun,
  type Icon,
} from "@tabler/icons-react";
import { useId, type FormEvent } from "react";
import {
  isThemeChoice,
  THEME_ACTION,
  type ThemeChoice,
} from "~/constants/theme";
import { useThemeChoice } from "~/contexts/ThemeChoiceContext";
import { useOfflineToast } from "~/hooks/useOfflineToast";

const OPTIONS: readonly {
  readonly value: ThemeChoice;
  readonly label: string;
  readonly icon: Icon;
}[] = [
  { value: "system", label: "System", icon: IconDeviceDesktop },
  { value: "light", label: "Light", icon: IconSun },
  { value: "dark", label: "Dark", icon: IconMoon },
];

const PLACEMENTS = {
  // 36 × 32 px; icon-only at md (the names stay for screen readers), icon
  // and text from lg. The error floats under the header instead of
  // stretching it.
  header: {
    group: "flex items-center gap-x-2",
    track: "inline-flex",
    button: "min-h-8 min-w-9 justify-center px-2 lg:px-3",
    label: "sr-only lg:not-sr-only",
    // At md the header is tight: the group's name stays for screen readers.
    groupLabel: "sr-only lg:not-sr-only",
    error:
      "absolute right-0 top-full z-header mt-2 w-max max-w-xs rounded-md border border-border bg-surface-raised px-3 py-2 shadow-2",
  },
  // In the drawer's thumb zone: 44 px tall, sharing the width, with text.
  drawer: {
    group: "flex flex-wrap items-center gap-x-3 gap-y-2",
    track: "flex w-full",
    button: "min-h-11 flex-1 justify-center px-3",
    label: "",
    groupLabel: "",
    error: "mt-2",
  },
} as const;

/**
 * System / Light / Dark (DESIGN §6.24): in the header from md, in the
 * drawer below. Without JS it is a plain form that posts the choice and
 * comes back to this page. With JS the choice is saved in the background
 * (ThemeChoiceContext) and the page switches before the answer; a failed
 * save reverts it and says so under the control (and, offline, in a toast).
 */
export function ThemeToggle({
  placement,
}: {
  readonly placement: keyof typeof PLACEMENTS;
}) {
  const look = PLACEMENTS[placement];
  const { choice, failure, save } = useThemeChoice();
  const reportOffline = useOfflineToast();
  const { pathname, search } = useLocation();
  const labelId = useId();

  async function saveInBackground(event: FormEvent<HTMLFormElement>) {
    const { submitter } = event.nativeEvent as SubmitEvent;
    if (!(submitter instanceof HTMLButtonElement)) return;
    if (!isThemeChoice(submitter.value)) return;
    event.preventDefault();
    const result = await save(submitter.value);
    if (!result.ok) reportOffline(result.error);
  }

  return (
    <Form
      method="post"
      action={THEME_ACTION}
      onSubmit={saveInBackground}
      className="relative"
    >
      <input type="hidden" name="returnTo" value={`${pathname}${search}`} />
      <div role="group" aria-labelledby={labelId} className={look.group}>
        <span
          id={labelId}
          className={`text-caption font-medium text-fg-muted ${look.groupLabel}`}
        >
          Theme
        </span>
        <div
          className={`${look.track} max-w-full flex-wrap rounded-full border border-border bg-surface-sunken p-0.5`}
        >
          {OPTIONS.map(({ value, label, icon: OptionIcon }) => (
            <button
              key={value}
              type="submit"
              name="theme"
              value={value}
              aria-pressed={choice === value}
              className={`inline-flex items-center gap-1.5 rounded-full border border-transparent text-body-sm font-medium text-fg-muted transition-colors duration-instant hover:text-fg aria-pressed:border-border-strong aria-pressed:bg-surface-raised aria-pressed:text-fg aria-pressed:shadow-1 ${look.button}`}
            >
              <OptionIcon size={18} stroke={1.75} aria-hidden="true" />
              <span className={look.label || undefined}>{label}</span>
            </button>
          ))}
        </div>
      </div>
      {failure ? (
        <p role="alert" className={`text-caption text-danger-fg ${look.error}`}>
          Couldn’t save your theme. Try again.
        </p>
      ) : null}
    </Form>
  );
}
