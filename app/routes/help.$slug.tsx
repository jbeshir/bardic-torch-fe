import { data, useLoaderData, useLocation } from "react-router";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { NOT_FOUND_META, NotFound } from "~/components/ErrorPages";
import { HelpPage } from "~/components/HelpPage";
import { pageMeta } from "~/catalogue/seo";
import { HELP_HREF } from "~/constants/navigation";
import { findHelpPage } from "~/content/help/pages";

/**
 * A help page (DESIGN §10.2), from app/content/help. An unknown slug is the
 * shell's 404 page with a real 404 status, like any unknown address.
 */
export function loader({ params }: LoaderFunctionArgs) {
  const page = findHelpPage(params["slug"]);
  return page ? { slug: page.slug } : data(null, { status: 404 });
}

export const meta: MetaFunction = args => {
  const page = findHelpPage(args.params["slug"]);
  if (!page) return [...NOT_FOUND_META];
  const { title, description, summary } = page.frontmatter;
  return pageMeta(args, {
    title,
    description,
    preview: summary,
    path: `${HELP_HREF}/${page.slug}`,
  });
};

export default function HelpRoute() {
  const loaded = useLoaderData<typeof loader>();
  const { pathname } = useLocation();
  const page = findHelpPage(loaded?.slug ?? undefined);
  return page ? <HelpPage content={page} /> : <NotFound pathname={pathname} />;
}
