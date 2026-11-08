import { useOutletContext } from "react-router";
import { PersonPage, type PersonView } from "~/components/person/PersonPage";

/**
 * `/bards/:slug`'s Read view (plan §4.6): the person its layout loaded.
 */
export default function BardRead() {
  return <PersonPage view={useOutletContext<PersonView>()} />;
}
