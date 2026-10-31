import { Link as RemixLink } from "@remix-run/react";
import { ExternalMark } from "~/components/ui/Link";
import { CONTACT_FORM_URL, WIKI_HOME_URL } from "~/constants/navigation";

const LINK =
  "inline-flex min-h-6 items-center rounded-sm text-fg-muted underline decoration-fg-subtle/50 underline-offset-prose hover:text-link-hover hover:decoration-2";

/**
 * Where to get help, the same on every page (DESIGN §5.7, WCAG 3.2.6):
 * Contact · Help · Licence & attribution, then the original wiki. Always
 * this order and these targets, in the footer of every template and on the
 * standalone error page.
 */
const HELP_LINKS = [
  { label: "Contact", href: CONTACT_FORM_URL, external: "web" },
  { label: "Help", href: "/help" },
  { label: "Licence & attribution", href: "/help/licence" },
  { label: "Original wiki", href: WIKI_HOME_URL, external: "wiki" },
] as const;

export function HelpLinks() {
  return (
    <ul
      role="list"
      aria-label="Help"
      className="flex flex-wrap items-center gap-x-2 gap-y-2 text-body-sm"
    >
      {HELP_LINKS.map((link, index) => (
        <li key={link.href} className="flex items-center gap-x-2">
          {index > 0 ? (
            <span aria-hidden="true" className="text-fg-subtle">
              ·
            </span>
          ) : null}
          {"external" in link ? (
            <a href={link.href} rel="noopener" className={LINK}>
              {link.label}
              <ExternalMark kind={link.external} />
            </a>
          ) : (
            <RemixLink to={link.href} className={LINK}>
              {link.label}
            </RemixLink>
          )}
        </li>
      ))}
    </ul>
  );
}
