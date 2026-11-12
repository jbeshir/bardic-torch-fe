import { useLocation } from "react-router";
import { Link } from "~/components/ui/Link";
import {
  BLOCKING_PATH,
  CONTACT_INBOX_PATH,
  MODERATION_PATH,
  TAKEDOWN_PATH,
} from "~/constants/moderation";

const PAGES = [
  { to: MODERATION_PATH, label: "Queue" },
  { to: CONTACT_INBOX_PATH, label: "Contact inbox" },
  { to: TAKEDOWN_PATH, label: "Take down a link" },
  { to: BLOCKING_PATH, label: "Block a user" },
] as const;

/** The moderators' pages, under each one's heading. */
export function ModerationNav() {
  const { pathname } = useLocation();
  return (
    <nav aria-label="Moderation" className="mt-3">
      <ul role="list" className="flex flex-wrap gap-x-6 gap-y-2 text-body-sm">
        {PAGES.map(({ to, label }) => (
          <li key={to}>
            <Link to={to} compact current={pathname === to}>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
