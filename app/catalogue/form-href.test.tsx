import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import { canonicalFormHref } from "./form-href";
import { pieceQuery } from "./query-state";

it("gives the canonical link for the form's fields, in any DOM order, dropping empty ones", () => {
  const { container } = render(
    <form>
      <input name="stub" defaultValue="false" />
      <input name="kind" defaultValue="poem" />
      <input name="kind" defaultValue="song" />
      <input name="q" defaultValue=" kettle " />
      <input name="letter" defaultValue="" />
    </form>
  );
  const form = container.querySelector("form");
  if (!form) throw new Error("no form");
  expect(canonicalFormHref(form, pieceQuery)).toBe(
    "/pieces?q=kettle&kind=song&kind=poem&stub=false"
  );
});
