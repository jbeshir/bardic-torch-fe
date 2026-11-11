/**
 * `T` readonly all the way down, for the API data components and loaders
 * pass around (CLAUDE.md rule 4): `DeepReadonly<components["schemas"]["X"]>`.
 */
export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T;
