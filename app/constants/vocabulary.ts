import type { components } from "~/api/schema.gen";

/**
 * Display labels for the API's enums (DESIGN §11), one `Record` per enum so
 * a new value is a type error until it has a label.
 */

/** How at risk a piece is of being lost, as the generated schema has it. */
export type ConservationStatus = components["schemas"]["ConservationStatus"];

/**
 * Every status, in the order the conservation help page lists them.
 * `satisfies` fails the type check if the API renames or drops a value;
 * a value it adds is a type error in `CONSERVATION_LABELS` and fails the
 * vocabulary test, so the list can't drift.
 */
export const CONSERVATION_STATUSES = [
  "low_risk",
  "endangered",
  "critically_endangered",
  "restricted",
  "unassessed",
] as const satisfies readonly ConservationStatus[];

/** Each status's label, in sentence case (DESIGN §2.5). */
export const CONSERVATION_LABELS: Readonly<Record<ConservationStatus, string>> =
  {
    low_risk: "Low risk",
    endangered: "Endangered",
    critically_endangered: "Critically endangered",
    restricted: "Restricted",
    unassessed: "Not yet assessed",
  };

/** Where a status is explained: its row on the conservation help page. */
export function conservationHelpPath(status: ConservationStatus): string {
  return `/help/conservation-status#${status}`;
}
