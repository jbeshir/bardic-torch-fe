import { Link } from "~/components/ui/Link";
import { LICENCE_URL } from "~/constants/navigation";
import { HelpLinks } from "./HelpLinks";
import { LogoMark } from "./LogoMark";

/**
 * The site footer (DESIGN §5.7): what Bardic Torch is, the text licence,
 * the non-affiliation statement (§11.4) and the help links.
 */
export function Footer() {
  return (
    <footer className="border-t border-border bg-canvas py-10 text-body-sm text-fg-muted">
      <div className="space-y-3 px-4 md:px-6 lg:px-0">
        <p className="flex items-center gap-2">
          <LogoMark className="h-5 w-5 text-fg" />
          Bardic Torch: an index of bardic pieces, kept by the community.
        </p>
        <p>
          Text is available under the{" "}
          <Link to={LICENCE_URL} appearance="muted">
            Creative Commons Attribution-ShareAlike 4.0
          </Link>{" "}
          licence.
        </p>
        <p>
          Bardic Torch is community-maintained and not affiliated with the
          Society for Creative Anachronism or any other organisation.
        </p>
        <div className="pt-2">
          <HelpLinks />
        </div>
      </div>
    </footer>
  );
}
