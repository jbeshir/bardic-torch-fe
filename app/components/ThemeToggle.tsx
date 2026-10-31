import { Form, useFetcher, useLocation } from "@remix-run/react";
import {
  IconDeviceDesktop,
  IconMoon,
  IconSun,
  type Icon,
} from "@tabler/icons-react";
import { useId, type FormEvent } from "react";
import {
  THEME_ACTION,
  THEME_FETCHER_KEY,
  type ThemeChoice,
} from "~/constants/theme";
import { useThemeChoice } from "~/hooks/useThemeChoice";
import type { action as themeAction } from "~/routes/resources.theme";

const OPTIONS: readonly {
  readonly value: ThemeChoice;
  readonly label: string;
  readonly icon: Icon;
}[] = [
  { value: "system", label: "System", icon: IconDeviceDesktop },
  { value: "light", label: "Light", icon: IconSun },
  { value: "dark", label: "Dark", icon: IconMoon },
];

/**
 * System / Light / Dark (DESIGN §6.24). Without JS it is a plain form that
 * posts the choice and comes back to this page. With JS the submit goes
 * through a fetcher instead, and the page switches before the answer.
 */
export function ThemeToggle() {
  const choice = useThemeChoice();
  const fetcher = useFetcher<typeof themeAction>({ key: THEME_FETCHER_KEY });
  const { pathname, search } = useLocation();
  const labelId = useId();
  const failed = fetcher.state === "idle" && fetcher.data?.ok === false;

  function submitWithFetcher(event: FormEvent<HTMLFormElement>) {
    const { submitter } = event.nativeEvent as SubmitEvent;
    if (!(submitter instanceof HTMLButtonElement)) return;
    event.preventDefault();
    fetcher.submit(
      { theme: submitter.value },
      { method: "post", action: THEME_ACTION }
    );
  }

  return (
    <Form method="post" action={THEME_ACTION} onSubmit={submitWithFetcher}>
      <input type="hidden" name="returnTo" value={`${pathname}${search}`} />
      <div
        role="group"
        aria-labelledby={labelId}
        className="flex flex-wrap items-center gap-x-3 gap-y-2"
      >
        <span id={labelId} className="text-caption font-medium text-fg-muted">
          Theme
        </span>
        <div className="inline-flex rounded-full border border-border bg-surface-sunken p-0.5">
          {OPTIONS.map(({ value, label, icon: OptionIcon }) => (
            <button
              key={value}
              type="submit"
              name="theme"
              value={value}
              aria-pressed={choice === value}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-transparent px-3 text-body-sm font-medium text-fg-muted transition-colors duration-instant hover:text-fg aria-pressed:border-border-strong aria-pressed:bg-surface-raised aria-pressed:text-fg aria-pressed:shadow-1"
            >
              <OptionIcon size={18} stroke={1.75} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </div>
      {failed ? (
        <p role="alert" className="mt-2 text-caption text-danger-fg">
          Couldn&apos;t save your theme. Try again.
        </p>
      ) : null}
    </Form>
  );
}
