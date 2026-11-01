import { IconSearch } from "@tabler/icons-react";
import { useId, useState } from "react";
import { Checkbox, CheckboxGroup } from "~/components/ui/Checkbox";
import { ErrorSummary } from "~/components/ui/ErrorSummary";
import { Field } from "~/components/ui/Field";
import { Input } from "~/components/ui/Input";
import { Select } from "~/components/ui/Select";
import { Textarea } from "~/components/ui/Textarea";
import { Button } from "~/components/ui/Button";
import { Example, Specimen } from "./Specimen";

export function Inputs() {
  return (
    <Specimen
      id="input"
      title="Field and Input"
      summary="Label, help, control and error wired together (DESIGN §6.4, §6.5). Optional fields are marked, not required ones."
    >
      <Example label="Rest, with help" stack>
        <Field
          label="Display name"
          help="Shown on your edits. Use 1 to 64 characters."
        >
          <Input name="display-name" defaultValue="Morwen of the Marches" />
        </Field>
      </Example>
      <Example label="Optional, with placeholder and icon" stack>
        <Field label="Search the wiki" optional>
          <Input
            type="search"
            name="q"
            icon={IconSearch}
            placeholder="A piece or a bard"
          />
        </Field>
      </Example>
      <Example label="Error" stack>
        <Field
          label="Display name"
          help="Shown on your edits."
          error="Enter a display name."
        >
          <Input name="display-name" defaultValue="" />
        </Field>
      </Example>
      <Example label="Disabled and read-only" stack>
        <Field label="Account id">
          <Input name="id" defaultValue="google-oauth2|1234" disabled />
        </Field>
        <Field label="Token prefix">
          <Input name="prefix" defaultValue="3f9c2a1b" readOnly />
        </Field>
      </Example>
    </Specimen>
  );
}

export function Textareas() {
  return (
    <Specimen
      id="textarea"
      title="Textarea"
      summary="The Input look, five lines tall, resizable vertically (DESIGN §6.6)."
    >
      <Example label="Rest" stack>
        <Field label="Notes" optional help="Where you heard it, and from whom.">
          <Textarea name="notes" />
        </Field>
      </Example>
      <Example label="Error and disabled" stack>
        <Field label="Notes" error="Notes can be up to 2,000 characters.">
          <Textarea name="notes" defaultValue="Sung at every revel since…" />
        </Field>
        <Field label="Notes">
          <Textarea name="notes" disabled defaultValue="Locked while saving." />
        </Field>
      </Example>
    </Specimen>
  );
}

export function Selects() {
  return (
    <Specimen
      id="select"
      title="Select"
      summary="A native select styled like Input; the options use the system picker in the page’s colour scheme (DESIGN §6.7)."
    >
      <Example label="Rest, error, disabled" stack>
        <Field label="Mood">
          <Select name="mood" defaultValue="singalong">
            <option value="singalong">Singalong</option>
            <option value="lament">Lament</option>
            <option value="comic">Comic</option>
          </Select>
        </Field>
        <Field label="Mood" error="Choose a mood.">
          <Select name="mood" defaultValue="">
            <option value="">Choose…</option>
            <option value="singalong">Singalong</option>
          </Select>
        </Field>
        <Field label="Mood">
          <Select name="mood" disabled defaultValue="lament">
            <option value="lament">Lament</option>
          </Select>
        </Field>
      </Example>
    </Specimen>
  );
}

export function Checkboxes() {
  return (
    <Specimen
      id="checkbox"
      title="Checkbox"
      summary="A native checkbox drawn from tokens; the whole row is the target, and forced colours get the system box (DESIGN §6.8)."
    >
      <Example label="Unchecked, checked, indeterminate" stack>
        <Checkbox name="singalong" label="Singalong" />
        <Checkbox
          name="lament"
          label="Lament"
          defaultChecked
          help="Slow and sad."
        />
        <Checkbox name="all" label="All moods" indeterminate />
      </Example>
      <Example label="Disabled and error" stack>
        <Checkbox name="locked" label="Locked choice" disabled />
        <Checkbox
          name="locked-on"
          label="Locked, checked"
          disabled
          defaultChecked
        />
        <Checkbox
          name="terms"
          label="I have the bard’s permission to link this"
          error="Confirm you have permission."
        />
      </Example>
      <Example label="Group with one error" stack>
        <CheckboxGroup
          legend="Where it may be performed"
          help="Choose at least one."
          error="Choose at least one place."
        >
          <Checkbox name="court" label="Court" />
          <Checkbox name="camp" label="Camp and fireside" />
        </CheckboxGroup>
      </Example>
    </Specimen>
  );
}

/** A form that fails on submit, to show the summary taking focus. */
function SummaryDemo() {
  const nameId = useId();
  const tokenId = useId();
  const [failed, setFailed] = useState(false);
  return (
    <form
      noValidate
      className="grid gap-5"
      onSubmit={event => {
        event.preventDefault();
        setFailed(true);
      }}
    >
      {failed ? (
        <ErrorSummary
          problems={[
            { fieldId: nameId, message: "Enter a display name." },
            {
              fieldId: tokenId,
              message: "Token names can be up to 128 characters.",
            },
          ]}
        />
      ) : null}
      <Field
        id={nameId}
        label="Display name"
        error={failed ? "Enter a display name." : undefined}
      >
        <Input name="name" />
      </Field>
      <Field
        id={tokenId}
        label="Token name"
        optional
        error={failed ? "Token names can be up to 128 characters." : undefined}
      >
        <Input name="token" defaultValue={"x".repeat(130)} />
      </Field>
      <div>
        <Button type="submit" variant="primary">
          Check the form
        </Button>
      </div>
    </form>
  );
}

export function ErrorSummaries() {
  return (
    <Specimen
      id="error-summary"
      title="Error summary"
      summary="Styleguide-only in FE1: the problems at the top of a failed form, linking to each field (DESIGN §6.4)."
    >
      <Example label="Submit to see it" stack>
        <SummaryDemo />
      </Example>
    </Specimen>
  );
}
