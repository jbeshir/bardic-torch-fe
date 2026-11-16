import type { components } from "~/api/schema.gen";

/** Types from the API spec (`schema.gen.ts`) that the app names. */

export type User = components["schemas"]["User"];
export type UpstreamErrorCode = components["schemas"]["Error"]["code"];
export type RevisionListItem = components["schemas"]["RevisionListItem"];
