import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { canonicalFormHref } from "./form-href";
import { pieceQuery } from "./query-state";

function formWith(fields: readonly (readonly [string, string])[]) {
  const { container } = render(
    <form>
      {fields.map(([name, value]) => (
        <input key={`${name}=${value}`} name={name} defaultValue={value} />
      ))}
      <input type="file" name="upload" />
    </form>
  );
  const form = container.querySelector("form");
  if (!form) throw new Error("no form");
  return form;
}

describe("canonicalFormHref", () => {
  it("gives the canonical link for the form's fields, in any DOM order", () => {
    const form = formWith([
      ["stub", "false"],
      ["kind", "poem"],
      ["kind", "song"],
      ["q", " kettle "],
      ["letter", "w"],
    ]);
    expect(canonicalFormHref(form, pieceQuery)).toBe(
      "/pieces?q=kettle&kind=song&kind=poem&stub=false&letter=W"
    );
  });

  it("drops empty fields, so nothing is left for an empty form", () => {
    expect(canonicalFormHref(formWith([["q", ""]]), pieceQuery)).toBe(
      "/pieces"
    );
  });
});
