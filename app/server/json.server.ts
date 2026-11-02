/**
 * A JSON response for the resource routes (the proxies, the theme route, the
 * CSRF refusal): `body` serialised, with `application/json; charset=utf-8`
 * unless `init` names another Content-Type. React Router has no `json()`
 * helper, and `Response.json()` sends no charset.
 */
export function jsonResponse<Body>(
  body: Body,
  init: ResponseInit = {}
): Response {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json; charset=utf-8");
  }
  return new Response(JSON.stringify(body), { ...init, headers });
}
