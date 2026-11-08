import type { Licence } from "~/schemas/catalogue";

/** The Creative Commons licences: one family each, never a version. */
export type CcLicence = Extract<Licence, `cc_${string}`>;

/**
 * The Creative Commons licences' family overview. The API gives a piece's
 * licence family without a version (spec issue B13), so a piece's CC
 * licence links here, never to a versioned deed.
 */
export const CC_LICENCES_URL = "https://creativecommons.org/licenses/";

/** Whether `licence` is a Creative Commons one. */
export function isCreativeCommons(licence: Licence): licence is CcLicence {
  return licence.startsWith("cc_");
}
