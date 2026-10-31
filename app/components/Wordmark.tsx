import { LogoMark } from "./LogoMark";

/**
 * The site's name with its mark (DESIGN §3.2, §5.9): "Bardic" in ink and
 * "Torch" in amber. It renders inline, so the parent gives it meaning (the
 * home link in the header, or a heading); its text is the accessible name.
 * `flicker`: the flame flickers when the enclosing `group` link is hovered.
 */
export function Wordmark({ flicker = false }: { flicker?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-display text-wordmark text-fg opsz-32">
      <LogoMark className="h-6 w-6 md:h-7 md:w-7" flicker={flicker} />
      <span>
        Bardic <span className="text-accent-text">Torch</span>
      </span>
    </span>
  );
}
