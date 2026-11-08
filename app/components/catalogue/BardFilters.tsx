import { useId, type ChangeEvent } from "react";
import { Form } from "react-router";
import { personQuery, type PersonQueryState } from "~/catalogue/query-state";
import { Disclosure } from "~/components/catalogue/Disclosure";
import { Button } from "~/components/ui/Button";
import { Checkbox, CheckboxGroup } from "~/components/ui/Checkbox";
import { SectionError } from "~/components/ui/ErrorState";
import { Select } from "~/components/ui/Select";
import { PERSON_KIND_LABELS, PERSON_ROLE_LABELS } from "~/constants/vocabulary";
import {
  personKindSchema,
  personRoleSchema,
  type TermList,
} from "~/schemas/catalogue";
import { HiddenFields, useCanonicalSubmit } from "./canonical-form";

type Terms = TermList["data"];

/** Where the filters apply as soon as one changes: the xl column. */
const XL_QUERY = "(min-width: 1280px)";

/**
 * The affiliation terms in tree order (as the API lists them), each named
 * with a dash per level under its root: "Northmarch", "— Barony of
 * Ashdown".
 */
function affiliationOptions(terms: Terms) {
  const depth = new Map<string, number>();
  return terms.map(term => {
    const level =
      term.parent_slug === null ? 0 : (depth.get(term.parent_slug) ?? 0) + 1;
    depth.set(term.slug, level);
    return {
      slug: term.slug,
      label: `${"— ".repeat(level)}${term.display_name}`,
    };
  });
}

/**
 * The bards directory's filters (plan §4.7): a GET form of Kind and Role
 * checkboxes and an Affiliation select (from the affiliation terms, or a
 * SectionError when they couldn't load), with the search, the letter and
 * the order kept as hidden inputs, only when set. It is mounted with the canonical
 * query as its key, so it always shows the URL's state. With JS it goes
 * straight to the canonical URL; at xl a change applies at once. Below
 * xl (and without JS) it is a closed "Filters" disclosure; at xl, with
 * JS, the page opens it.
 */
export function BardFilters({
  state,
  affiliations,
}: {
  readonly state: PersonQueryState;
  /** Null when the affiliation terms couldn't load. */
  readonly affiliations: Terms | null;
}) {
  const { onSubmit, apply } = useCanonicalSubmit(personQuery);
  const affiliationId = useId();
  const applyAtXl = (event: ChangeEvent<HTMLFormElement>) => {
    if (window.matchMedia(XL_QUERY).matches) apply(event.currentTarget);
  };
  return (
    <Disclosure summary="Filters" openWhen={XL_QUERY}>
      <Form
        method="get"
        action="/bards"
        aria-label="Filter bards"
        onSubmit={onSubmit}
        onChange={applyAtXl}
        className="grid gap-6"
      >
        <HiddenFields
          href={personQuery.href({
            ...state,
            kind: [],
            role: [],
            affiliation: undefined,
          })}
        />
        <CheckboxGroup legend="Kind">
          {personKindSchema.options.map(kind => (
            <Checkbox
              key={kind}
              name="kind"
              value={kind}
              label={PERSON_KIND_LABELS[kind]}
              defaultChecked={state.kind.includes(kind)}
            />
          ))}
        </CheckboxGroup>
        <CheckboxGroup legend="Role">
          {personRoleSchema.options.map(role => (
            <Checkbox
              key={role}
              name="role"
              value={role}
              label={PERSON_ROLE_LABELS[role]}
              defaultChecked={state.role.includes(role)}
            />
          ))}
        </CheckboxGroup>
        {affiliations ? (
          <div className="grid gap-2">
            <span
              id={affiliationId}
              className="text-body-sm font-semibold text-fg"
            >
              Affiliation
            </span>
            <Select
              aria-labelledby={affiliationId}
              name="affiliation"
              defaultValue={state.affiliation ?? ""}
            >
              <option value="">Any affiliation</option>
              {affiliationOptions(affiliations).map(option => (
                <option key={option.slug} value={option.slug}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        ) : (
          <SectionError title="We couldn’t load the affiliations" />
        )}
        <div>
          <Button type="submit" variant="secondary" size="sm">
            Apply filters
          </Button>
        </div>
      </Form>
    </Disclosure>
  );
}
