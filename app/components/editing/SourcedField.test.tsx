import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CONSERVATION_LABELS } from "~/constants/vocabulary";
import { labelOptions } from "./fields";
import { SourcedField } from "./SourcedField";

describe("SourcedField", () => {
  it("labels the source and says it is needed unless the status is exempt", () => {
    render(
      <SourcedField
        legend="Conservation status"
        name="conservation.status"
        value="endangered"
        options={labelOptions(CONSERVATION_LABELS)}
        exempt={CONSERVATION_LABELS.unassessed}
        sourceName="conservation.source_url"
        sourceValue={null}
      />
    );
    expect(
      screen.getByRole("textbox", { name: "Source (URL) (optional)" })
    ).toHaveAccessibleDescription(
      "Needed unless the status is ‘Not yet assessed’: a page that shows it."
    );
  });
});
