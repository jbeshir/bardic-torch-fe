import { useEffect, useRef } from "react";
import { Alert } from "./Alert";

type Problem = {
  /** The invalid control's id. */
  readonly fieldId: string;
  /** What the summary says: the field, then the error under it. */
  readonly message: string;
};

/**
 * The list of problems at the top of a form that failed: a
 * danger Alert headed "Check {n} thing(s) below", linking to each field.
 * It is `role="alert"`, so a server-rendered summary is announced when the
 * page loads; once the page has loaded its scripts, focus moves to it.
 */
export function ErrorSummary({
  problems,
}: {
  readonly problems: readonly [Problem, ...Problem[]];
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    boxRef.current?.focus();
  }, []);

  const count = problems.length;
  return (
    <div
      ref={boxRef}
      role="alert"
      tabIndex={-1}
      className="rounded-lg focus-visible:outline-offset-2"
    >
      <Alert
        tone="danger"
        headingLevel={2}
        title={`Check ${count} ${count === 1 ? "thing" : "things"} below`}
      >
        <ul className="list-disc stack-y-1 pl-5">
          {problems.map(({ fieldId, message }) => (
            <li key={fieldId}>
              <a
                href={`#${fieldId}`}
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
