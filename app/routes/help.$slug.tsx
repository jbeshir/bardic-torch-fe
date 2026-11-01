import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { json } from "@remix-run/cloudflare";
import { useLoaderData, useLocation } from "@remix-run/react";
import { NOT_FOUND_META, NotFound } from "~/components/ErrorPages";
import { HelpPage, helpMeta } from "~/components/HelpPage";
import { findHelpPage } from "~/content/help/pages";

/**
 * A help page (DESIGN §10.2), from app/content/help. An unknown slug is the
 * shell's 404 page with a real 404 status, like any unknown address.
 */
export function loader({ params }: LoaderFunctionArgs) {
  const page = findHelpPage(params["slug"]);
  return page ? json({ slug: page.slug }) : json(null, { status: 404 });
}

export const meta: MetaFunction = ({ params }) => {
  const page = findHelpPage(params["slug"]);
  return page ? helpMeta(page.frontmatter) : [...NOT_FOUND_META];
};

export default function HelpRoute() {
  const data = useLoaderData<typeof loader>();
  const { pathname } = useLocation();
  const page = findHelpPage(data?.slug ?? undefined);
  return page ? <HelpPage content={page} /> : <NotFound pathname={pathname} />;
}
