import type { MetaFunction } from "@remix-run/cloudflare";

export const meta: MetaFunction = () => [{ title: "Bardic Torch" }];

export default function Index() {
  return (
    <main>
      <h1 className="text-3xl font-bold">Bardic Torch</h1>
    </main>
  );
}
