import { IconCheck, IconCopy } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { Alert } from "~/components/ui/Alert";
import { Button } from "~/components/ui/Button";
import { textControlClasses } from "~/components/ui/Input";

type CopyState = "idle" | "copied" | "failed";

/**
 * The one-time reveal of a new token's secret (DESIGN §10.3). It comes
 * from the create response and can never be fetched again, so it says so.
 * The value sits in a read-only box that wraps, with focus moved to it and
 * the value selected; Copy uses the clipboard and reports how that went;
 * "I've copied it" removes the secret from the page.
 */
export function TokenReveal({
  secret,
  onDismiss,
}: {
  secret: string;
  onDismiss: () => void;
}) {
  const value = useRef<HTMLTextAreaElement>(null);
  const [copy, setCopy] = useState<CopyState>("idle");

  // Mounted once per new token (the parent keys it by the token).
  useEffect(() => {
    value.current?.focus();
    value.current?.select();
  }, []);

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(secret);
      setCopy("copied");
    } catch {
      setCopy("failed");
      value.current?.focus();
      value.current?.select();
    }
  }

  return (
    <Alert
      tone="success"
      title="Token created. Copy it now — you won't see it again."
      actions={
        <Button variant="ghost" onClick={onDismiss}>
          I&apos;ve copied it
        </Button>
      }
    >
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start">
        <textarea
          ref={value}
          readOnly
          rows={2}
          value={secret}
          aria-label="New token value"
          spellCheck={false}
          className={`${textControlClasses({ invalid: false, readOnly: true })} wrap-anywhere min-h-11 resize-none select-all py-2 font-mono text-code`}
        />
        <Button
          icon={copy === "copied" ? IconCheck : IconCopy}
          onClick={copyToClipboard}
        >
          {copy === "copied" ? "Copied" : "Copy"}
        </Button>
      </div>
      <p role="status" className={copy === "failed" ? "mt-2" : "sr-only"}>
        {copy === "copied" ? "Token copied" : null}
        {copy === "failed"
          ? "Your browser didn't let us copy it. The token is selected: copy it with your keyboard or menu."
          : null}
      </p>
    </Alert>
  );
}
