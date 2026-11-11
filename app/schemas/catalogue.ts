import type { components, operations } from "~/api/schema.gen";
import type { DeepReadonly } from "./contract";

/**
 * The catalogue's response types, straight from the API spec
 * (`api/openapi.yaml`, via `~/api/schema.gen`). Response bodies are not
 * validated at runtime: the API is the source of truth for its own shape.
 */

type Schemas = components["schemas"];

/** An operation's query object, as the generated types have it. */
export type ApiQuery<Id extends keyof operations> = DeepReadonly<
  NonNullable<operations[Id]["parameters"]["query"]>
>;

export type ConservationStatus = Schemas["ConservationStatus"];
export type Letter = Schemas["Letter"];
export type PieceKind = Schemas["PieceKind"];
export type PieceSort = Schemas["PieceSort"];
export type PersonSort = Schemas["PersonSort"];
export type Facet = Schemas["Facet"];
export type PersonKind = Schemas["PersonKind"];
export type EventKind = Schemas["EventKind"];
export type Licence = Schemas["Licence"];
export type LicensingStatus = Schemas["LicensingStatus"];
export type PieceAliasKind = Schemas["PieceAliasKind"];
export type PersonAliasKind = Schemas["PersonAliasKind"];
export type PiecePart = Schemas["PiecePart"];
export type CreditRole = Schemas["CreditRole"];
export type Attribution = Schemas["Attribution"];
export type Certainty = Schemas["Certainty"];
export type PieceRelationType = Schemas["PieceRelationType"];
export type PersonRelationType = Schemas["PersonRelationType"];
export type RelationDirection = Schemas["RelationDirection"];
export type PersonStatus = Schemas["PersonStatus"];
export type PersonRole = Schemas["PersonRole"];
export type LinkPlaceType = Schemas["LinkPlaceType"];
export type LinkRole = Schemas["LinkRole"];
export type CollectionKind = Schemas["CollectionKind"];
export type CollectionEnumerable = Schemas["CollectionEnumerable"];
export type PieceSummary = DeepReadonly<Schemas["PieceSummary"]>;
export type PieceList = DeepReadonly<Schemas["PieceList"]>;
export type PieceFacets = DeepReadonly<Schemas["PieceFacets"]>;
export type TermListItem = DeepReadonly<Schemas["TermListItem"]>;
export type TermList = DeepReadonly<Schemas["TermList"]>;
export type PersonSummary = DeepReadonly<Schemas["PersonSummary"]>;
export type PersonList = DeepReadonly<Schemas["PersonList"]>;
export type TermSummary = DeepReadonly<Schemas["TermSummary"]>;
export type Piece = DeepReadonly<Schemas["Piece"]>;
export type Person = DeepReadonly<Schemas["Person"]>;
export type Term = DeepReadonly<Schemas["Term"]>;
export type CollectionSummary = DeepReadonly<Schemas["CollectionSummary"]>;
export type CollectionList = DeepReadonly<Schemas["CollectionList"]>;
export type CollectionCitation = DeepReadonly<Schemas["CollectionCitation"]>;
export type Collection = DeepReadonly<Schemas["Collection"]>;
export type EventList = DeepReadonly<Schemas["EventList"]>;
export type EventPerformance = DeepReadonly<Schemas["EventPerformance"]>;
export type Event = DeepReadonly<Schemas["Event"]>;
export type RevisionSummary = DeepReadonly<Schemas["RevisionSummary"]>;
export type RevisionHistory = DeepReadonly<Schemas["RevisionHistory"]>;
export type Revision = DeepReadonly<Schemas["Revision"]>;
