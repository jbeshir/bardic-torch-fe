import type { FormEvent } from "react";
import { useNavigate } from "react-router";
import { canonicalFormHref } from "~/catalogue/form-href";

/**
 * The parameters of `href`'s query, to carry as hidden inputs: the state
 * a form keeps while it changes other values, in canonical form.
 */
export function HiddenFields({ href }: { readonly href: string }) {
  const search = href.includes("?") ? href.slice(href.indexOf("?")) : "";
  return [...new URLSearchParams(search)].map(([name, value]) => (
    // Canonical, so no name and value repeats.
    <input key={`${name}=${value}`} type="hidden" name={name} value={value} />
  ));
}

type Query<State> = Parameters<typeof canonicalFormHref<State>>[1];

/**
 * Goes to the canonical URL a GET form asks for (plan §2.5), in one
 * request and keeping the scroll position: the raw form is never sent with
 * JS. Without JS the browser sends the fields in DOM order, which the
 * loader answers 200 all the same.
 */
export function useCanonicalNavigate<State>(query: Query<State>) {
  const navigate = useNavigate();
  return (form: HTMLFormElement) => {
    void navigate(canonicalFormHref(form, query), {
      preventScrollReset: true,
    });
  };
}

/** A GET form's `onSubmit` that goes to its canonical URL instead. */
export function useCanonicalSubmit<State>(query: Query<State>) {
  const go = useCanonicalNavigate(query);
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    go(event.currentTarget);
  };
}
