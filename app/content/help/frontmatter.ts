import { z } from "zod";

/**
 * A help page's front matter (plan §0.10). `description` is the meta
 * description, so it fits a search result; `summary` is the social preview
 * line; `sourcePages` are the original wiki pages the text is adapted from
 * (by title), which the page credits and links to; `lastReviewed` is the
 * day the text was last checked against the site's rules.
 */
export const helpFrontmatterSchema = z
  .object({
    title: z.string().trim().min(1),
    description: z.string().trim().min(1).max(160),
    summary: z.string().trim().min(1),
    sourcePages: z.array(z.string().trim().min(1)).readonly(),
    lastReviewed: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "a date, YYYY-MM-DD")
      .refine(day => !Number.isNaN(Date.parse(day)), "a real date"),
  })
  .strict();

export type HelpFrontmatter = z.infer<typeof helpFrontmatterSchema>;
