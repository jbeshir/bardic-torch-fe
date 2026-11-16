import { data, useLocation } from "react-router";
import type { MetaFunction } from "react-router";
import { NOT_FOUND_META, NotFound } from "~/components/ErrorPages";

/**
 * Every address no other route matches: the 404 page inside the shell,
 * with a real 404 status.
 */
export function loader() {
  return data(null, { status: 404 });
}

export const meta: MetaFunction = () => [...NOT_FOUND_META];

export default function NotFoundRoute() {
  const { pathname } = useLocation();
  return <NotFound pathname={pathname} />;
}
