import { IconX, type Icon } from "@tabler/icons-react";
import { useId, useRef, type ReactNode, type RefObject } from "react";
import { Button } from "./Button";
import { useModalDialog } from "./useModalDialog";

type Confirm = {
  readonly label: string;
  /** The leading icon; the busy spinner takes its place. */
  readonly icon: Icon;
  /** `danger` for destructive confirms ("Revoke token"). */
  readonly variant: "primary" | "danger";
  /** For a confirm that runs code; leave out when it submits `form`. */
  readonly onConfirm?: () => void;
  /** The id of a form (inside the dialog) that the button submits. */
  readonly form?: string;
};

/**
 * A modal dialog (DESIGN §6.22) on a native `<dialog>`: named by its h2,
 * described by `description`, with Cancel and one confirm button. Focus
 * starts on Cancel (the least destructive control) unless `initialFocus`
 * names a field, stays inside while open and goes back to the opener on
 * close. Escape and the close button always cancel; the backdrop only
 * when the dialog isn't destructive. While `pending`, nothing closes it and
 * the confirm button is busy. Below sm the buttons stack full width with
 * Cancel at the bottom, nearest the thumb.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  confirm,
  cancelLabel = "Cancel",
  pending = false,
  initialFocus,
  fallbackFocus,
}: {
  open: boolean;
  /** Called for every way of closing; set `open` false in response. */
  onClose: () => void;
  title: string;
  /** A short body, which becomes the dialog's description. */
  description?: string;
  /** Anything else in the body, e.g. a form with its fields. */
  children?: ReactNode;
  confirm: Confirm;
  cancelLabel?: string;
  pending?: boolean;
  /** Focus this on open instead of Cancel: a form's first field. */
  initialFocus?: RefObject<HTMLElement>;
  /** Where focus goes on close if the opener is gone, e.g. a list heading. */
  fallbackFocus?: () => HTMLElement | null;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const cancel = useRef<HTMLButtonElement>(null);
  const dialog = useModalDialog({
    open,
    onClose,
    initialFocus: initialFocus ?? cancel,
    fallbackFocus,
    dismissible: !pending,
    closeOnBackdrop: confirm.variant !== "danger",
  });

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className="m-auto w-dialog max-w-none rounded-xl border border-border bg-surface-raised p-0 text-fg shadow-3 backdrop:bg-scrim/scrim motion-safe:animate-dialog-in motion-reduce:animate-fade-in motion-safe:backdrop:animate-fade-in"
    >
      {open ? (
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <h2 id={titleId} className="text-h3 text-fg">
              {title}
            </h2>
            <span className="-mr-2 -mt-1 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                icon={IconX}
                label="Close"
                disabled={pending}
                onClick={onClose}
              />
            </span>
          </div>
          {description ? (
            <p id={descriptionId} className="mt-2 text-body-sm text-fg-muted">
              {description}
            </p>
          ) : null}
          {children ? <div className="mt-4">{children}</div> : null}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              ref={cancel}
              variant="secondary"
              disabled={pending}
              onClick={onClose}
            >
              {cancelLabel}
            </Button>
            <Button
              variant={confirm.variant}
              icon={confirm.icon}
              loading={pending}
              type={confirm.form ? "submit" : "button"}
              form={confirm.form}
              onClick={confirm.onConfirm}
            >
              {confirm.label}
            </Button>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
