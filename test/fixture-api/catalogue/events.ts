import type { components } from "../../../app/api/schema.gen";

/** The raw event records of the fixture catalogue (all invented). */

type Schemas = components["schemas"];

export type RawEvent = Readonly<
  Omit<Schemas["Event"], "performances" | "performances_total" | "updated_at">
>;

/** The event of the 203 capped performances. */
export const MUSTER_FIELD_SLUG = "muster-field";
export const MIDWINTER_REVEL_SLUG = "midwinter-revel";
/** An event nothing was performed at. */
const QUIET_HALL_SLUG = "quiet-hall";

const event = (slug: string, name: string): RawEvent => ({ slug, name });

export const EVENTS: readonly RawEvent[] = [
  event(MIDWINTER_REVEL_SLUG, "Midwinter Revel"),
  event(MUSTER_FIELD_SLUG, "Muster Field"),
  event("the-copper-hearth", "The Copper Hearth"),
  event("westerfell-crown-tourney", "Westerfell Crown Tourney"),
  event("caer-wyn-bardic-circle", "Caer Wyn Bardic Circle"),
  event("greywater-harvest-feast", "Greywater Harvest Feast"),
  event("ashdown-twelfth-night", "Ashdown Twelfth Night"),
  event(QUIET_HALL_SLUG, "Quiet Hall"),
];

const BY_SLUG: ReadonlyMap<string, RawEvent> = new Map(
  EVENTS.map(e => [e.slug, e])
);

/** The event with this slug; throws for a slug that isn't in the catalogue. */
export function rawEvent(slug: string): RawEvent {
  const found = BY_SLUG.get(slug);
  if (!found) throw new Error(`no such event: ${slug}`);
  return found;
}

/** An event as other entities refer to it. */
export function eventSummary(slug: string): Schemas["EventSummary"] {
  return { slug, name: rawEvent(slug).name };
}
