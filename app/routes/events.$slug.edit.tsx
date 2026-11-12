import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "react-router";
import { EventEditor } from "~/components/editing/EventForm";
import { matchData } from "~/catalogue/history-meta";
import { editorMeta } from "~/editing/editor-data";
import type { Event } from "~/schemas/catalogue";
import {
  editorAction,
  editorLoader,
  previewDescription,
} from "~/server/editing.server";

/** `/events/:slug/edit`: the Edit view, under its layout's head. */

export function loader(args: LoaderFunctionArgs) {
  return editorLoader(args, { type: "event", key: args.params.slug ?? "" });
}

export function action(args: ActionFunctionArgs) {
  return editorAction(args, { type: "event", preview: previewDescription });
}

export const meta: MetaFunction = args => {
  const layout = matchData(args, "routes/events.$slug") as
    { readonly event: Event } | undefined;
  return editorMeta(`Edit ${layout?.event.name ?? "the event"}`);
};

export default function EventEditRoute() {
  return <EventEditor />;
}
