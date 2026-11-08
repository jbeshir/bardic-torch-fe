import type { ReactNode } from "react";
import { Button, ButtonLink } from "~/components/ui/Button";
import { Drawer } from "~/components/ui/Drawer";

/**
 * The piece filters below xl (plan §4.3, DESIGN §6.28), on the Drawer: a
 * bottom sheet below md, the left edge from md, closed once the viewport
 * reaches xl, where the facet column takes over. Its body is the facet
 * form (`children`, without its own Apply); its footer, in the thumb
 * zone, "Show results" (that form's submit, through its `form` id) and
 * "Clear all".
 *
 * There is no live result count. Show results goes to the canonical URL
 * and the navigation closes the drawer, focus going back to the Filters
 * button. Escape or Close discard the unapplied ticks: the form is only
 * mounted while the drawer is open, from the URL's state.
 */
export function FacetDrawer({
  id,
  open,
  onClose,
  form,
  clearHref,
  children,
}: {
  /** For the Filters button's `aria-controls`. */
  readonly id: string;
  readonly open: boolean;
  readonly onClose: () => void;
  /** The facet form's id, which Show results submits. */
  readonly form: string;
  /** The list without its filters (the search and the letter kept). */
  readonly clearHref: string;
  readonly children: ReactNode;
}) {
  return (
    <Drawer
      id={id}
      open={open}
      onClose={onClose}
      title="Filter pieces"
      closeLabel="Close filters"
      closeFrom="xl"
      footer={
        <div className="grid gap-3">
          <Button type="submit" form={form} variant="primary" fullWidth>
            Show results
          </Button>
          <ButtonLink to={clearHref} nofollow fullWidth>
            Clear all
          </ButtonLink>
        </div>
      }
    >
      {children}
    </Drawer>
  );
}
