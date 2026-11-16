import { Link } from "~/components/ui/Link";
import { WIKI_HOME_URL } from "~/constants/navigation";

/**
 * Where to get help, the same on every page (WCAG 3.2.6):
 * the original wiki. Always
 * this order and these targets, in the footer of every template and on the
 * standalone error page. A `separated-list` (base.css): when it wraps, no
 * line starts with a "·".
 */
const HELP_LINKS = [{ label: "Original wiki", href: WIKI_HOME_URL }] as const;

export function HelpLinks() {
  return (
    <ul
      role="list"
      aria-label="Help"
      className="separated-list gap-y-2 text-body-sm"
    >
      {HELP_LINKS.map(link => (
        <li key={link.href}>
          <span aria-hidden="true" className="separated-list-mark">
            ·
          </span>
          <Link to={link.href} appearance="muted" compact>
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
