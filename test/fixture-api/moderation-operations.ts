import type { components } from "../../app/api/schema.gen";

type Schemas = components["schemas"];
type User = Schemas["User"];

export type ModerationState = {
  readonly users: Map<string, User>;
};
