import { useEffect, useRef, type MouseEvent } from "react";
import { Alert } from "./Alert";

type Problem = {
  /** The invalid control's id: the `id` given to its Field. */
  readonly fieldId: string;
  /** The same words as the error under the field. */
  readonly message: string;
};

/** Focuses the control a summary link points at, as well as scrolling to it. */
function focusField(event: MouseEvent<HTMLAnchorElement>, fieldId: string) {
  const field = document.getElementById(fieldId);
  if (!field) return;
  event.preventDefault();
  field.focus();
}

/**
 * The list of problems at the top of a form that failed (DESIGN §6.4): a
 * danger Alert headed "Check {n} thing(s) below", linking to each field.
 * It is `role="alert"`, so a server-rendered summary is announced when the
 * page loads (no JS); with JS, focus moves to it after a failed submit.
 * Render it first in the form.
 */
export function ErrorSummary({
  problems,
}: {
  problems: readonly [Problem, ...Problem[]];
}) {
  const box = useRef<HTMLDivElement>(null);
  // Move focus when the problems change (a new failed submit), not on every
  // render of the form around it.
  const signature = problems
    .map(({ fieldId, message }) => `${fieldId}:${message}`)
    .join("\n");

  useEffect(() => {
    box.current?.focus();
  }, [signature]);

  const count = problems.length;
  return (
    <div
      ref={box}
      role="alert"
      tabIndex={-1}
      className="rounded-lg focus-visible:outline-offset-2"
    >
      <Alert
        tone="danger"
        headingLevel={2}
        title={`Check ${count} ${count === 1 ? "thing" : "things"} below`}
      >
        <ul className="list-disc space-y-1 pl-5">
          {problems.map(({ fieldId, message }) => (
            <li key={fieldId}>
              <a
                href={`#${fieldId}`}
                onClick={event => focusField(event, fieldId)}
                className="font-medium text-inherit underline underline-offset-prose hover:decoration-2"
              >
                {message}
              </a>
            </li>
          ))}
        </ul>
      </Alert>
    </div>
  );
}
