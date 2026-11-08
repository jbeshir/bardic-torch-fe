import { COLLECTION_KINDS } from "~/constants/enums";
import { Form } from "react-router";
import { Disclosure } from "~/components/catalogue/Disclosure";
import { Button } from "~/components/ui/Button";
import { Checkbox, CheckboxGroup } from "~/components/ui/Checkbox";
import {
  collectionQuery,
  type CollectionQueryState,
} from "~/catalogue/query-state";
import {
  HiddenFields,
  useCanonicalSubmit,
} from "~/components/catalogue/canonical-form";
import { formatNumber } from "~/catalogue/format";
import { COLLECTION_KIND_LABELS } from "~/constants/vocabulary";

/**
 * The kind filter of `/collections` (plan §4.9, §2.5): a GET form of
 * checkboxes in a disclosure, open while a kind is chosen. It keeps the
 * letter as a hidden input and drops the page. Without JS "Apply" sends
 * the boxes in DOM order (answered 200); with JS it goes straight to the
 * canonical URL. Its page mounts it keyed by the canonical query, so a
 * chip or a letter link never leaves a stale box ticked.
 */
export function CollectionKindFilter({
  state,
}: {
  readonly state: CollectionQueryState;
}) {
  const onSubmit = useCanonicalSubmit(collectionQuery);
  const chosen = state.kind.length;
  return (
    <div className="rounded-lg border border-border bg-surface-raised p-4">
      <Disclosure
        open={chosen > 0}
        summary={`Filter by kind${chosen > 0 ? ` (${formatNumber(chosen)} selected)` : ""}`}
      >
        <Form
          method="get"
          action="/collections"
          className="grid gap-4"
          onSubmit={onSubmit}
        >
          <HiddenFields href={collectionQuery.href(state, { kind: [] })} />
          <CheckboxGroup legend="Kind">
            <div className="grid gap-1 sm:grid-cols-2">
              {COLLECTION_KINDS.map(kind => (
                <Checkbox
                  key={kind}
                  name="kind"
                  value={kind}
                  label={COLLECTION_KIND_LABELS[kind]}
                  defaultChecked={state.kind.includes(kind)}
                />
              ))}
            </div>
          </CheckboxGroup>
          <div>
            <Button type="submit" variant="secondary" size="sm">
              Apply filters
            </Button>
          </div>
        </Form>
      </Disclosure>
    </div>
  );
}
