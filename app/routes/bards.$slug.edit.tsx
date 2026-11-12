import {
  useActionData,
  useLoaderData,
  useOutletContext,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "react-router";
import { EditorPage } from "~/components/editing/EditorPage";
import { PersonForm, PERSON_PICKERS } from "~/components/editing/PersonForm";
import { EntityPage } from "~/components/EntityPage";
import {
  PersonBody,
  personHead,
  type PersonView,
} from "~/components/person/PersonPage";
import { matchData } from "~/catalogue/history-meta";
import { editorMeta } from "~/editing/editor-data";
import { editorAction, editorLoader } from "~/server/editing.server";
import { previewPerson } from "~/server/preview.server";

/** `/bards/:slug/edit`: the Edit view, under their head (`personHead`). */

export function loader(args: LoaderFunctionArgs) {
  return editorLoader(args, {
    type: "person",
    key: args.params.slug ?? "",
    pickers: PERSON_PICKERS,
  });
}

export function action(args: ActionFunctionArgs) {
  return editorAction(args, {
    type: "person",
    preview: previewPerson,
    pickers: PERSON_PICKERS,
  });
}

export const meta: MetaFunction = args => {
  const layout = matchData(args, "routes/bards.$slug") as
    PersonView | undefined;
  return editorMeta(`Edit ${layout?.person.name ?? "the bard"}`);
};

export default function BardEditRoute() {
  const loaded = useLoaderData<typeof loader>();
  const outcome = useActionData<typeof action>();
  const { person, pending } = useOutletContext<PersonView>();
  return (
    <EntityPage {...personHead(person)} pending={pending}>
      <EditorPage
        loaded={loaded}
        action={outcome}
        preview={
          outcome?.preview ? <PersonBody view={outcome.preview} /> : null
        }
      >
        {document => (
          <PersonForm document={document} options={loaded.options} />
        )}
      </EditorPage>
    </EntityPage>
  );
}
