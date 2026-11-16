import { formatNumber } from "~/catalogue/format";

/**
 * "and 5 more not listed here", when the API capped a list and there are
 * more than it gave (works, performances and citations: at most 200).
 */
export function MoreNotListed({
  shown,
  total,
}: {
  readonly shown: number;
  readonly total: number;
}) {
  return total > shown ? (
    <p className="mt-3 text-body-sm text-fg-muted">
      {`and ${formatNumber(total - shown)} more not listed here`}
    </p>
  ) : null;
}
