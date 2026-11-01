import type { MetaFunction } from "@remix-run/cloudflare";
import { json } from "@remix-run/cloudflare";
import { useLocation } from "@remix-run/react";
import { NOT_FOUND_META, NotFound } from "~/components/ErrorPages";

/**
 * Every address no other route matches: the 404 page inside the shell
 * (DESIGN §10.4), with a real 404 status.
 */
export function loader() {
  return json(null, { status: 404 });
}

export const meta: MetaFunction = () => [...NOT_FOUND_META];

export default function NotFoundRoute() {
  const { pathname } = useLocation();
  return <NotFound pathname={pathname} />;
}
