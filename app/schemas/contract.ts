import type { z } from "zod";

/**
 * Compile-time contract checks between zod schemas and the types generated
 * from the API spec. A schema's output must equal the generated type in both
 * directions. zod types optional keys as `?: T | undefined`, which
 * `exactOptionalPropertyTypes` tells apart from the generated `?: T`; the
 * spec never sends `undefined`, so that difference is removed first.
 */

type WithoutUndefined<T> = T extends object
  ? { [K in keyof T]: WithoutUndefined<Exclude<T[K], undefined>> }
  : T;

type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

export type Matches<S extends z.ZodType, Generated> = Equals<
  WithoutUndefined<z.output<S>>,
  WithoutUndefined<Generated>
>;

export type Assert<T extends true> = T;
