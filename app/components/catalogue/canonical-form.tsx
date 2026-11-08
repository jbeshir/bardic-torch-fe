import type { FormEvent } from "react";
import { useNavigate } from "react-router";
import { canonicalFormHref } from "~/catalogue/form-href";

/** A list page's URL state, as `canonicalFormHref` reads it. */
type Query<State> = Parameters<typeof canonicalFormHref<State>>[1];

/**
 * The parameters of `href`'s query, to carry as hidden inputs: the state
 * a form keeps while it changes one value, in canonical form.
 */
export function HiddenFields({ href }: { readonly href: string }) {
  const search = href.includes("?") ? href.slice(href.indexOf("?")) : "";
  return [...new URLSearchParams(search)].map(([name, value]) => (
    // Canonical, so no name and value repeats.
    <input key={`${name}=${value}`} type="hidden" name={name} value={value} />
  ));
}

/**
 * Submits a GET form the canonical way (plan §2.5): with JS the raw form
 * is never sent, the page goes straight to the canonical URL; without JS
 * the browser sends the fields, which the loader answers 200 all the same.
 */
export function useCanonicalSubmit<State>(query: Query<State>) {
  const navigate = useNavigate();
  const go = (form: HTMLFormElement) =>
    navigate(canonicalFormHref(form, query), { preventScrollReset: true });
  return {
    onSubmit(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      void go(event.currentTarget);
    },
    /** Applies the form now: a filter changed where they apply at once. */
    apply(form: HTMLFormElement) {
      void go(form);
    },
  };
}
