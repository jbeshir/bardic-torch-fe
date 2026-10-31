import { IconX } from "@tabler/icons-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type ReactNode,
} from "react";
import { TONE_GLYPHS, TONE_NAMES } from "./Alert";
import { Button } from "./Button";

type ToastTone = "success" | "info" | "danger";

type ToastMessage = {
  /** success and info are polite and leave after 6 s; danger stays. */
  readonly tone: ToastTone;
  /** One sentence, never the only copy of something important. */
  readonly message: string;
};

type ToastEntry = ToastMessage & {
  readonly id: number;
  readonly leaving: boolean;
};

/** DESIGN §6.23. */
const AUTO_DISMISS_MS = 6000;
const MAX_TOASTS = 3;
/** The exit fade (`duration-fast`). */
const LEAVE_MS = 120;

const TONES: Record<ToastTone, { bar: string; icon: string }> = {
  success: { bar: "border-l-success-icon", icon: "text-success-icon" },
  info: { bar: "border-l-info-icon", icon: "text-info-icon" },
  danger: { bar: "border-l-danger-icon", icon: "text-danger-icon" },
};

const ShowToast = createContext<((toast: ToastMessage) => void) | null>(null);

/**
 * Shows a toast: brief feedback after something the reader did, raised from
 * a fetcher's result (DESIGN §6.23, §7.4). The page must show the outcome
 * too (the saved value, or an inline Alert). Needs the ToastProvider that
 * root.tsx renders around every page.
 */
export function useToast(): (toast: ToastMessage) => void {
  const show = useContext(ShowToast);
  if (!show) throw new Error("useToast() needs a ToastProvider around it");
  return show;
}

/** At most three; making room drops the oldest that would leave anyway. */
function withRoomFor(toasts: readonly ToastEntry[]): readonly ToastEntry[] {
  const shown = toasts.filter(({ leaving }) => !leaving);
  if (shown.length < MAX_TOASTS) return toasts;
  const oldest =
    shown.find(({ tone }) => tone !== "danger") ?? (shown[0] as ToastEntry);
  return toasts.filter(toast => toast !== oldest);
}

/**
 * Holds the toasts and renders their region once, after the page. Rendered
 * by root.tsx; pages call `useToast()`.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<readonly ToastEntry[]>([]);
  const nextId = useRef(1);

  const show = useCallback((toast: ToastMessage) => {
    const id = nextId.current;
    nextId.current += 1;
    setToasts(current => [
      ...withRoomFor(current),
      { ...toast, id, leaving: false },
    ]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts(current =>
      current.map(toast =>
        toast.id === id ? { ...toast, leaving: true } : toast
      )
    );
    setTimeout(
      () => setToasts(current => current.filter(toast => toast.id !== id)),
      LEAVE_MS
    );
  }, []);

  return (
    <ShowToast.Provider value={show}>
      {children}
      <ToastRegion toasts={toasts} onDismiss={dismiss} />
    </ShowToast.Provider>
  );
}

/**
 * The Notifications landmark (DESIGN §6.23): empty in the server render,
 * with a polite status list (success, info) and an assertive alert list
 * (danger) that are always mounted, so each new toast is announced. Below
 * sm it sits at the top under the header, so it never covers the bottom
 * bar or the control that raised it; from sm, bottom right. The newest toast
 * is nearest the edge. Timers pause while the pointer is over the region or
 * focus is inside it.
 */
function ToastRegion({
  toasts,
  onDismiss,
}: {
  toasts: readonly ToastEntry[];
  onDismiss: (id: number) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const paused = hovered || focused;

  function onBlur(event: FocusEvent<HTMLElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
  }

  const list = (tone: "polite" | "urgent") =>
    toasts
      .filter(({ tone: t }) => (t === "danger") === (tone === "urgent"))
      .map(toast => (
        <Toast
          key={toast.id}
          toast={toast}
          paused={paused}
          onDismiss={onDismiss}
        />
      ));

  const stack = "flex flex-col-reverse gap-2 sm:flex-col";
  return (
    <section
      aria-label="Notifications"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={onBlur}
      className={`pointer-events-none fixed inset-x-4 top-toast z-toast sm:inset-x-auto sm:bottom-above-app-bar sm:right-6 sm:top-auto md:bottom-6 sm:w-96 ${stack}`}
    >
      <div
        role="status"
        aria-live="polite"
        aria-atomic="false"
        className={stack}
      >
        {list("polite")}
      </div>
      <div role="alert" aria-live="assertive" className={stack}>
        {list("urgent")}
      </div>
    </section>
  );
}

function Toast({
  toast: { id, tone, message, leaving },
  paused,
  onDismiss,
}: {
  toast: ToastEntry;
  paused: boolean;
  onDismiss: (id: number) => void;
}) {
  // What is left of the 6 s, kept across pauses.
  const remaining = useRef(AUTO_DISMISS_MS);

  useEffect(() => {
    if (tone === "danger" || paused || leaving) return;
    const started = Date.now();
    const timer = setTimeout(() => onDismiss(id), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current -= Date.now() - started;
    };
  }, [id, tone, paused, leaving, onDismiss]);

  const Glyph = TONE_GLYPHS[tone];
  const motion = leaving
    ? "opacity-0 transition-opacity duration-fast ease-in"
    : "motion-safe:animate-toast-in motion-reduce:animate-fade-in";
  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 rounded-lg border border-l-3 border-border bg-surface-raised p-4 shadow-2 ${TONES[tone].bar} ${motion}`}
    >
      <Glyph
        size={20}
        stroke={1.75}
        aria-hidden="true"
        className={`mt-0.5 shrink-0 ${TONES[tone].icon}`}
      />
      <p className="min-w-0 flex-1 self-center text-body-sm text-fg">
        <span className="sr-only">{TONE_NAMES[tone]}: </span>
        {message}
      </p>
      <span className="-my-2 -mr-2 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          icon={IconX}
          label="Dismiss notification"
          onClick={() => onDismiss(id)}
        />
      </span>
    </div>
  );
}
