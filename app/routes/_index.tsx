import type { MetaFunction } from "@remix-run/cloudflare";

export const meta: MetaFunction = () => [{ title: "Bardic Torch" }];

export default function Index() {
  return (
    <main className="mx-auto max-w-form px-4 py-12 md:px-6">
      <div className="rounded-xl border border-border bg-surface p-6 shadow-1 md:p-8">
        <h1 className="text-h1 text-fg">Bardic Torch</h1>
        <p className="mt-4 text-body-lg text-fg-muted">
          A community-kept index of bardic pieces and the bards who made them.
          The new site is being built.
        </p>
      </div>
    </main>
  );
}
