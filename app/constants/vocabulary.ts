/**
 * Display labels for the API's enums (DESIGN §11), one `Record` per enum so
 * a new value is a type error until it has a label.
 */

/**
 * How at risk a piece is of being lost (the API's `ConservationStatus`), in
 * the order the conservation help page lists them.
 */
export const CONSERVATION_STATUSES = [
  "low_risk",
  "endangered",
  "critically_endangered",
  "restricted",
  "unassessed",
] as const;

export type ConservationStatus = (typeof CONSERVATION_STATUSES)[number];

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
