import type { RevisionSummary } from "~/schemas/catalogue";

/** Names joined as a reader writes them: "A", "A and B", "A, B and C". */
function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1) ?? ""}`;
}

/**
 * Who made a revision (plan §4.11): its author; for an import, the original wiki and the wiki users
 * who wrote it (CC BY-SA attribution, so always named when the API has
 * them); "Unknown" for an author the API doesn't show.
 */
export function revisionCredit(
  revision: Pick<RevisionSummary, "source" | "author" | "contributors">
): string {
  if (revision.source === "import") {
    return revision.contributors.length > 0
      ? `Imported from the original wiki, by ${joinNames(revision.contributors)}`
      : "Imported from the original wiki";
  }
  return revision.author?.display_name ?? "Unknown";
}
