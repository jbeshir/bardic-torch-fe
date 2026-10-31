import type { MetaFunction } from "@remix-run/cloudflare";
import { Wordmark } from "~/components/Wordmark";

export const meta: MetaFunction = () => [
  { title: "Bardic Torch" },
  {
    name: "description",
    content:
      "A community-kept index of bardic pieces and the bards who made them.",
  },
];

/** The home page, until its content arrives: the name and what it is. */
export default function Index() {
  return (
    <div className="max-w-prose">
      <h1>
        <Wordmark />
      </h1>
      <p className="mt-4 text-body-lg text-fg-muted">
        A community-kept index of bardic pieces and the bards who made them. The
        new site is being built.
      </p>
    </div>
  );
}
