import type { MetaFunction } from "@remix-run/cloudflare";
import { json } from "@remix-run/cloudflare";
import { useLocation } from "@remix-run/react";
import { NotFound } from "~/components/ErrorPages";

/**
 * Every address no other route matches: the 404 page inside the shell
 * (DESIGN §10.4), with a real 404 status.
 */
export function loader() {
  return json(null, { status: 404 });
}

export const meta: MetaFunction = () => [
  { title: "Page not found · Bardic Torch" },
  { name: "robots", content: "noindex" },
];

export default function NotFoundRoute() {
  const { pathname } = useLocation();
  return <NotFound pathname={pathname} />;
}
