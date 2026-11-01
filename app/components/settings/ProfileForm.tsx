import { useFetcher } from "@remix-run/react";
import { IconDeviceFloppy } from "@tabler/icons-react";
import { useRef, useState, type FormEvent } from "react";
import { AlertRegion } from "~/components/ui/Alert";
import { Button } from "~/components/ui/Button";
import { Field } from "~/components/ui/Field";
import { Input } from "~/components/ui/Input";
import { useToast } from "~/components/ui/Toast";
import { SETTINGS_INTENT, SETTINGS_PATH } from "~/constants/account";
import { useHydrated } from "~/hooks/useHydrated";
import { useOfflineToast } from "~/hooks/useOfflineToast";
import type { User } from "~/schemas/api";
import type { ProxyBody, ProxyError } from "~/schemas/proxy";
import { DISPLAY_NAME_RULE, displayNameProblem } from "~/schemas/rules";
import { ProblemAlert } from "./ProblemAlert";
import { fieldMessage, useFetcherResult } from "./results";

const SAVE_FAILED =
  "We couldn’t save your changes. Check your connection and try again.";

/**
 * The display name form (DESIGN §10.3). It checks the name with the API's
 * rule before sending; the fetcher submits to the settings route, whose
 * `clientAction` sends `PATCH /api/me`, and the root loader revalidates
 * after a save, so the account menu shows the new name too. A rejected
 * name is an inline error (focus goes back to the field); anything else,
 * including no network or a response the app didn't make, is a danger
 * Alert under the button, and the typed name stays. It needs JS, so Save
 * stays disabled until the page has hydrated.
 */
export function ProfileForm({ user }: { readonly user: User }) {
  const fetcher = useFetcher<ProxyBody<User>>();
  const show = useToast();
  const reportOffline = useOfflineToast();
  const hydrated = useHydrated();
  const input = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user.display_name);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [failure, setFailure] = useState<ProxyError | null>(null);
  const saving = fetcher.state !== "idle";

  function reject(message: string) {
    setFieldError(message);
    setFailure(null);
    input.current?.focus();
  }

  useFetcherResult(fetcher, result => {
    if (result.ok) {
      setName(result.data.display_name);
      setFieldError(null);
      setFailure(null);
      show({ tone: "success", message: "Display name saved." });
      return;
    }
    const message = fieldMessage(result.error, "display_name");
    if (message) {
      reject(message);
    } else {
      setFieldError(null);
      setFailure(result.error);
      reportOffline(result.error);
    }
  });

  function checkBeforeSending(event: FormEvent<HTMLFormElement>) {
    const problem = displayNameProblem(name);
    if (problem) {
      event.preventDefault();
      reject(problem);
    }
  }

  return (
    <fetcher.Form
      method="post"
      action={SETTINGS_PATH}
      noValidate
      onSubmit={checkBeforeSending}
    >
      <input
        type="hidden"
        name="intent"
        value={SETTINGS_INTENT.updateProfile}
      />
      <Field
        label="Display name"
        help={`Shown on your edits and in page history. Use your SCA name if you like. ${DISPLAY_NAME_RULE}`}
        error={fieldError ?? undefined}
      >
        <Input
          ref={input}
          name="display_name"
          value={name}
          onChange={event => setName(event.target.value)}
          autoComplete="nickname"
          spellCheck={false}
        />
      </Field>
      <div className="mt-4">
        <Button
          type="submit"
          variant="primary"
          icon={IconDeviceFloppy}
          loading={saving}
          disabled={!hydrated}
        >
          Save changes
        </Button>
      </div>
      <p role="status" className="sr-only">
        {saving ? "Saving your display name…" : ""}
      </p>
      <AlertRegion urgent>
        {failure ? (
          <div className="mt-4">
            <ProblemAlert error={failure} fallback={SAVE_FAILED} />
          </div>
        ) : null}
      </AlertRegion>
    </fetcher.Form>
  );
}
