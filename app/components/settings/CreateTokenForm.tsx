import type { FetcherWithComponents } from "@remix-run/react";
import { IconPlus } from "@tabler/icons-react";
import { useState, type FormEvent, type RefObject } from "react";
import { Button } from "~/components/ui/Button";
import { Field } from "~/components/ui/Field";
import { Input } from "~/components/ui/Input";
import { SETTINGS_INTENT, SETTINGS_PATH } from "~/constants/account";
import { useHydrated } from "~/hooks/useHydrated";
import { TOKEN_NAME_RULE, tokenNameProblem } from "~/schemas/rules";

/**
 * "Create token" with its optional name (DESIGN §10.3): the name is checked
 * with the API's rule before `fetcher`, which the tokens section owns (it
 * shows the result), submits it to the settings route, whose
 * `clientAction` sends `POST /api/tokens`. Inline from md,
 * stacked below; the button sits in the field's row, so a field error
 * lines up under both. Needs JS, so the button is disabled until hydration.
 */
export function CreateTokenForm({
  fetcher,
  inputRef,
  fieldError,
  onInvalid,
}: {
  fetcher: FetcherWithComponents<unknown>;
  /** The name field, which the section focuses when the server rejects it. */
  inputRef: RefObject<HTMLInputElement>;
  /** The server's or the browser's message for the name, if any. */
  fieldError: string | null;
  /** Called with the browser's message when the name breaks the rule. */
  onInvalid: (message: string) => void;
}) {
  const hydrated = useHydrated();
  const [name, setName] = useState("");

  function checkBeforeSending(event: FormEvent<HTMLFormElement>) {
    const problem = tokenNameProblem(name);
    if (problem) {
      event.preventDefault();
      onInvalid(problem);
      inputRef.current?.focus();
    }
  }

  return (
    <fetcher.Form
      method="post"
      action={SETTINGS_PATH}
      noValidate
      onSubmit={checkBeforeSending}
    >
      <input type="hidden" name="intent" value={SETTINGS_INTENT.createToken} />
      <Field
        label="Token name"
        optional
        help={`So you can tell your tokens apart, e.g. ‘Laptop MCP’. ${TOKEN_NAME_RULE}`}
        error={fieldError ?? undefined}
      >
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="min-w-0 md:flex-1">
            <Input
              ref={inputRef}
              name="name"
              value={name}
              onChange={event => setName(event.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="shrink-0">
            <Button
              type="submit"
              icon={IconPlus}
              loading={fetcher.state !== "idle"}
              disabled={!hydrated}
            >
              Create token
            </Button>
          </div>
        </div>
      </Field>
    </fetcher.Form>
  );
}
