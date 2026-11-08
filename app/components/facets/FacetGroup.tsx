import { IconChevronDown } from "@tabler/icons-react";
import { Checkbox } from "~/components/ui/Checkbox";
import { formatCount, formatNumber } from "~/catalogue/format";
import type {
  FacetGroup as Group,
  FacetOption,
} from "~/catalogue/facet-groups";

/** A term's indent under its parents, one step per level. */
const INDENTS = ["", "pl-6", "pl-12", "pl-16"] as const;

function indent(depth: number): string {
  return INDENTS[Math.min(depth, INDENTS.length - 1)] ?? "";
}

/**
 * One option: the label and its count, "Warlike (31)", named "Warlike, 31
 * pieces". The count is the API's disjunctive one (the pieces this value
 * would match with the other facets' filters), so it never reads "+N".
 */
function Option({
  name,
  option,
}: {
  readonly name: Group["name"];
  readonly option: FacetOption;
}) {
  return (
    <li className={indent(option.depth)}>
      <Checkbox
        name={name}
        value={option.value}
        defaultChecked={option.selected}
        disabled={option.disabled}
        label={
          <>
            {option.label}
            <span
              aria-hidden="true"
              className={`tabular-nums ${option.disabled ? "text-fg-subtle" : "text-fg-muted"}`}
            >
              {" "}
              ({formatNumber(option.count)})
            </span>
            <span className="sr-only">
              , {formatCount(option.count, "piece")}
            </span>
          </>
        }
      />
    </li>
  );
}

/**
 * A facet's checkboxes (plan §2.3, DESIGN §6.28): a fieldset with its
 * legend, the options in tree order (indented by depth), and past the
 * first 8 a "Show all {n}" disclosure, a native `<details>` that works
 * without JS. A ticked option is always shown; an option nothing would
 * match is greyed and can't be ticked.
 */
export function FacetGroup({ group }: { readonly group: Group }) {
  const total = group.shown.length + group.more.length;
  return (
    <fieldset>
      <legend className="text-body-sm font-semibold text-fg">
        {group.legend}
      </legend>
      <ul role="list" className="mt-1">
        {group.shown.map(option => (
          <Option key={option.value} name={group.name} option={option} />
        ))}
      </ul>
      {group.more.length > 0 ? (
        <details className="group">
          <summary className="summary-plain inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-sm text-body-sm font-medium text-link hover:text-link-hover lg:min-h-8">
            <span className="group-open:hidden">
              Show all {formatNumber(total)}
            </span>
            <span className="hidden group-open:inline">Show fewer</span>
            <span className="sr-only">
              {" "}
              {group.legend.toLowerCase()} options
            </span>
            <IconChevronDown
              size={16}
              stroke={1.75}
              aria-hidden="true"
              className="group-open:rotate-180"
            />
          </summary>
          <ul role="list">
            {group.more.map(option => (
              <Option key={option.value} name={group.name} option={option} />
            ))}
          </ul>
        </details>
      ) : null}
    </fieldset>
  );
}
