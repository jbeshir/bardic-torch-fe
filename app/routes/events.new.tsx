import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { EventEditor } from "~/components/editing/EventForm";
import { editorMeta } from "~/editing/editor-data";
import {
  editorAction,
  editorLoader,
  previewDescription,
} from "~/server/editing.server";

/** `/events/new`: a new event or venue. */

export function loader(args: LoaderFunctionArgs) {
  return editorLoader(args, { type: "event" });
}

export function action(args: ActionFunctionArgs) {
  return editorAction(args, { type: "event", preview: previewDescription });
}

export const meta = () => editorMeta("New event or venue");

export default function NewEventRoute() {
  return <EventEditor heading="New event or venue" />;
}
