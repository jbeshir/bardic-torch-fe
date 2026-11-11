import { Fragment } from "react";
import { Form } from "react-router";
import {
  HiddenFields,
  useCanonicalNavigate,
  useCanonicalSubmit,
} from "~/components/catalogue/canonical-form";
import { Button } from "~/components/ui/Button";
import { SectionError } from "~/components/ui/ErrorState";
import { Radio } from "~/components/ui/Radio";
import type { FacetGroup as Group } from "~/catalogue/facet-groups";
import {
  NO_PIECE_FILTERS,
  pieceQuery,
  type PieceQueryState,
} from "~/catalogue/query-state";
import { FacetGroup } from "./FacetGroup";

const PIECES_ACTION = "/pieces";

/** The "Page state" choices: `stub` unset, `true` or `false`. */
const STUB_CHOICES = [
  { value: "", label: "All pages", stub: undefined },
  { value: "true", label: "Stubs only", stub: true },
  { value: "false", label: "Hide stubs", stub: false },
] as const;

/**
 * The piece filters (plan §2.5): one GET form to `/pieces`
 * with a fieldset per facet (`FacetGroup`), the "Page state" (`stub`)
 * radios and "Apply filters". `q` and `letter` ride along as hidden inputs
 * when set; the page doesn't, since new filters start at page 1. The sort
 * select above the results belongs to it too (its `form` attribute).
 *
 * Its boxes start from the URL's state (`defaultChecked`), and the caller
 * mounts it in a `KeptFocus` keyed on the canonical query, so any change
 * of URL (a chip, a letter, Back) rebuilds it from the new state, an
 * unapplied tick can't linger, and the focused box stays focused. With
 * JS it never submits itself: Apply (and, with `autoSubmit`, any change)
 * goes straight to the canonical URL. Without JS, Apply sends the fields
 * in DOM order, which the loader answers 200.
 */
export function FacetForm({
  id,
  state,
  groups,
  termsFailed,
  autoSubmit,
  apply,
}: {
  readonly id: string;
  readonly state: PieceQueryState;
  readonly groups: readonly Group[];
  /** The terms couldn't be loaded: say so where their facets would be. */
  readonly termsFailed: boolean;
  /** Apply every change at once (the persistent column, from xl, with JS). */
  readonly autoSubmit: boolean;
  /** Show the "Apply filters" button (the drawer has its own footer). */
  readonly apply: boolean;
}) {
  const onSubmit = useCanonicalSubmit(pieceQuery);
  const go = useCanonicalNavigate(pieceQuery);
  return (
    <Form
      id={id}
      method="get"
      action={PIECES_ACTION}
      onSubmit={onSubmit}
      onChange={autoSubmit ? event => go(event.currentTarget) : undefined}
      className="grid gap-6"
    >
      {/* What the filters keep: the search and the letter (the order is
          the sort select's, by its form attribute; the page starts again). */}
      <HiddenFields
        href={pieceQuery.href({
          ...NO_PIECE_FILTERS,
          q: state.q,
          letter: state.letter,
        })}
      />
      {groups.map(group => (
        <Fragment key={group.key}>
          <FacetGroup group={group} />
          {group.key === "kind" && termsFailed ? (
            // Where the term facets would be: kind, status and page state
            // don't need the terms, so they stay.
            <SectionError title="We couldn’t load the categories">
              The other filters still work.
            </SectionError>
          ) : null}
        </Fragment>
      ))}
      <fieldset>
        <legend className="text-body-sm font-semibold text-fg">
          Page state
        </legend>
        <div className="mt-1">
          {STUB_CHOICES.map(choice => (
            <Radio
              key={choice.value}
              name="stub"
              value={choice.value}
              defaultChecked={state.stub === choice.stub}
              label={choice.label}
            />
          ))}
        </div>
      </fieldset>
      {apply ? (
        <div>
          <Button type="submit" variant="secondary" size="sm">
            Apply filters
          </Button>
        </div>
      ) : null}
    </Form>
  );
}
