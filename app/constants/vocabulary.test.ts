import { describe, expect, it } from "vitest";
import {
  ATTRIBUTION_LABELS,
  CERTAINTY_QUALIFIERS,
  CONSERVATION_LABELS,
  CC_LICENCE_SHORT_NAMES,
  CONSERVATION_STATUSES,
  CREDIT_ROLE_LABELS,
  DECEASED_LABELS,
  FACET_LABELS,
  LICENCE_LABELS,
  LINK_PLACE_TYPE_LABELS,
  LINK_ROLE_LABELS,
  PERSON_ALIAS_KIND_LABELS,
  PERSON_KIND_LABELS,
  PERSON_RELATION_LABELS,
  PERSON_ROLE_LABELS,
  PIECE_ALIAS_KIND_LABELS,
  PIECE_KIND_LABELS,
  PIECE_PART_LABELS,
  PIECE_RELATION_LABELS,
  WORK_ROLE_HEADINGS,
} from "~/constants/vocabulary";
import { loadSpec } from "../../test/contract/openapi";
import { conservationStatusSchema, pieceKindSchema } from "~/schemas/catalogue";

describe("conservation vocabulary", () => {
  it("lists exactly the statuses that have a label (the labels are typed against the generated schema)", () => {
    expect([...CONSERVATION_STATUSES].sort()).toEqual(
      Object.keys(CONSERVATION_LABELS).sort()
    );
  });

  it("lists each status once", () => {
    expect(new Set(CONSERVATION_STATUSES).size).toBe(
      CONSERVATION_STATUSES.length
    );
  });
});

describe("piece kind vocabulary", () => {
  it("labels every kind the API has, in sentence case", () => {
    expect(Object.keys(PIECE_KIND_LABELS)).toEqual(pieceKindSchema.options);
    for (const label of Object.values(PIECE_KIND_LABELS)) {
      expect(label).toMatch(/^[A-Z][a-z ]+$/);
    }
  });

  it("orders the conservation statuses the API's way in the schema, the help page's way here", () => {
    expect([...conservationStatusSchema.options].sort()).toEqual(
      [...CONSERVATION_STATUSES].sort()
    );
  });
});

/** The values of the spec's enum `name`, in its order. */
function specEnum(name: string): readonly string[] {
  const schema = loadSpec().components.schemas[name] as { enum: string[] };
  return schema.enum;
}

describe("piece page vocabulary (C4.1)", () => {
  it.each([
    ["facets", FACET_LABELS, specEnum("Facet")],
    ["credit roles", CREDIT_ROLE_LABELS, specEnum("CreditRole")],
    ["parts", PIECE_PART_LABELS, specEnum("PiecePart")],
  ] as const)(
    "labels every one of the %s, in sentence case",
    (_what, labels, values) => {
      expect(Object.keys(labels)).toEqual(values);
      for (const label of Object.values(labels)) {
        expect(label).toMatch(/^[A-Z][a-z ]+$/);
      }
    }
  );

  it("labels every attribution but named, whose credit shows the person", () => {
    expect(Object.keys(ATTRIBUTION_LABELS)).toEqual(
      specEnum("Attribution").filter(value => value !== "named")
    );
  });

  it("qualifies every certainty but certain", () => {
    expect(Object.keys(CERTAINTY_QUALIFIERS)).toEqual(
      specEnum("Certainty").filter(value => value !== "certain")
    );
  });

  it("labels every piece alias kind but redirect, a search aid", () => {
    expect(Object.keys(PIECE_ALIAS_KIND_LABELS)).toEqual(
      specEnum("PieceAliasKind").filter(value => value !== "redirect")
    );
  });
});

describe("link vocabulary (C4.3)", () => {
  it("labels every link role and place type, in the spec's order", () => {
    expect(Object.keys(LINK_ROLE_LABELS)).toEqual(specEnum("LinkRole"));
    expect(Object.keys(LINK_PLACE_TYPE_LABELS)).toEqual(
      specEnum("LinkPlaceType")
    );
  });
});

describe("licensing and relation vocabulary (C4.4)", () => {
  it("names every licence, and has a short name for each Creative Commons one", () => {
    expect(Object.keys(LICENCE_LABELS)).toEqual(specEnum("Licence"));
    expect(Object.keys(CC_LICENCE_SHORT_NAMES)).toEqual(
      specEnum("Licence").filter(licence => licence.startsWith("cc_"))
    );
    for (const name of Object.values(CC_LICENCE_SHORT_NAMES)) {
      expect(name).toMatch(/^CC BY(-(NC|SA|ND))*$/);
    }
  });

  it("reads every piece relation both ways", () => {
    expect(Object.keys(PIECE_RELATION_LABELS)).toEqual(
      specEnum("PieceRelationType")
    );
    for (const labels of Object.values(PIECE_RELATION_LABELS)) {
      expect(Object.keys(labels)).toEqual(specEnum("RelationDirection"));
    }
  });
});

describe("bard page vocabulary (C5.1)", () => {
  it("labels every person kind, role, credit role's works and relation", () => {
    expect(Object.keys(PERSON_KIND_LABELS)).toEqual(specEnum("PersonKind"));
    expect(Object.keys(DECEASED_LABELS)).toEqual(specEnum("PersonKind"));
    expect(Object.keys(PERSON_ROLE_LABELS)).toEqual(specEnum("PersonRole"));
    expect(Object.keys(WORK_ROLE_HEADINGS)).toEqual(specEnum("CreditRole"));
    expect(Object.keys(PERSON_RELATION_LABELS).sort()).toEqual(
      [...specEnum("PersonRelationType")].sort()
    );
    for (const labels of Object.values(PERSON_RELATION_LABELS)) {
      expect(Object.keys(labels)).toEqual(specEnum("RelationDirection"));
    }
  });

  it("labels every person alias kind but redirect", () => {
    expect(Object.keys(PERSON_ALIAS_KIND_LABELS)).toEqual(
      specEnum("PersonAliasKind").filter(kind => kind !== "redirect")
    );
  });
});
