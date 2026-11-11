import type { components } from "../../../app/api/schema.gen";

/** The raw event and venue records of the fixture catalogue (all invented). */

type Schemas = components["schemas"];

export type RawEvent = Readonly<
  Omit<Schemas["Event"], "performances" | "performances_total">
>;

/** The venue of the 203 capped performances. */
export const MUSTER_FIELD_SLUG = "muster-field";
export const MIDWINTER_REVEL_SLUG = "midwinter-revel";
/** An event nothing was performed at. */
const QUIET_HALL_SLUG = "quiet-hall";

function event(
  slug: string,
  name: string,
  kind: Schemas["EventKind"],
  description: string | null = null
): RawEvent {
  return { slug, name, kind, description_md: description };
}

export const EVENTS: readonly RawEvent[] = [
  event(
    MIDWINTER_REVEL_SLUG,
    "Midwinter Revel",
    "event",
    "A winter feast with **long** evenings of song."
  ),
  event(
    MUSTER_FIELD_SLUG,
    "Muster Field",
    "venue",
    "An open field where the drill sessions are held."
  ),
  event(
    "the-copper-hearth",
    "The Copper Hearth",
    "venue",
    "A tavern with a *large* fireplace."
  ),
  event("westerfell-crown-tourney", "Westerfell Crown Tourney", "event"),
  event(
    "caer-wyn-bardic-circle",
    "Caer Wyn Bardic Circle",
    "event",
    "Meets monthly.\n\n- Open floor\n- All welcome"
  ),
  event("greywater-harvest-feast", "Greywater Harvest Feast", "event"),
  event(
    "ashdown-twelfth-night",
    "Ashdown Twelfth Night",
    "event",
    "Held in the barony each January."
  ),
  event(QUIET_HALL_SLUG, "Quiet Hall", "venue"),
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

/** An event or venue as other entities refer to it. */
export function eventSummary(slug: string): Schemas["EventSummary"] {
  const { name, kind } = rawEvent(slug);
  return { slug, name, kind };
}
