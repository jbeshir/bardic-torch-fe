/**
 * The canonical link a GET filter form asks for (plan §2.5). Without JS a
 * form submits its fields in DOM order, which the loader answers 200 (an
 * order-only difference). With JS the raw form is never submitted: the
 * caller prevents the submit and navigates here instead, so it lands on
 * the canonical URL in one request, never a 301.
 */
export function canonicalFormHref<State>(
  form: HTMLFormElement,
  query: {
    readonly parse: (params: URLSearchParams) => { readonly state: State };
    readonly href: (state: State) => string;
  }
): string {
  const params = new URLSearchParams();
  for (const [name, value] of new FormData(form)) {
    if (typeof value === "string") params.append(name, value);
  }
  return query.href(query.parse(params).state);
}
