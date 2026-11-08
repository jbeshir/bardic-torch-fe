import {
  IconArrowRight,
  IconDeviceFloppy,
  IconMenu2,
  IconPlus,
  IconSearch,
  IconTrash,
} from "@tabler/icons-react";
import { useState } from "react";
import { Alert } from "~/components/ui/Alert";
import { Button, ButtonLink } from "~/components/ui/Button";
import { Link } from "~/components/ui/Link";
import { WIKI_HOME_URL } from "~/constants/navigation";
import { Example, Specimen } from "./Specimen";

/** A toggle button: its pressed state flips on each press. */
function PressedDemo() {
  const [pressed, setPressed] = useState(true);
  return (
    <Button aria-pressed={pressed} onClick={() => setPressed(!pressed)}>
      Singalong only
    </Button>
  );
}

export function Buttons() {
  return (
    <Specimen
      id="button"
      title="Button"
      summary="Real buttons, and ButtonLink for actions that navigate (DESIGN §6.2). Danger always has an icon and a verb."
    >
      <Example label="Variants">
        <Button variant="primary" icon={IconDeviceFloppy}>
          Save changes
        </Button>
        <Button>Cancel</Button>
        <Button variant="ghost">Skip for now</Button>
        <Button variant="danger" icon={IconTrash}>
          Revoke token
        </Button>
        <Button variant="secondary-danger" icon={IconTrash}>
          Revoke
        </Button>
      </Example>
      <Example label="Sizes: sm, md, lg">
        <Button size="sm" icon={IconPlus}>
          Add
        </Button>
        <Button size="md" icon={IconPlus}>
          Add
        </Button>
        <Button size="lg" variant="primary" trailingIcon={IconArrowRight}>
          How to contribute
        </Button>
      </Example>
      <Example label="Icon only (named by its label)">
        <Button size="sm" variant="ghost" icon={IconSearch} label="Search" />
        <Button variant="ghost" icon={IconMenu2} label="Menu" />
        <Button size="lg" icon={IconPlus} label="Create token" />
      </Example>
      <Example label="Disabled">
        <Button variant="primary" disabled>
          Save changes
        </Button>
        <Button disabled>Cancel</Button>
        <Button variant="danger" icon={IconTrash} disabled>
          Revoke token
        </Button>
      </Example>
      <Example label="Loading (busy, still focusable)">
        <Button variant="primary" icon={IconDeviceFloppy} loading>
          Save changes
        </Button>
        <Button icon={IconPlus} loading>
          Create token
        </Button>
        <Button variant="danger" icon={IconTrash} loading>
          Revoke token
        </Button>
      </Example>
      <Example label="Pressed (toggle)">
        <PressedDemo />
      </Example>
      <Example label="Full width">
        <Button variant="primary" size="lg" fullWidth>
          Create token
        </Button>
      </Example>
      <Example label="ButtonLink: internal and to the original wiki">
        <ButtonLink to="/" variant="primary" icon={IconArrowRight}>
          Go to the home page
        </ButtonLink>
        <ButtonLink to={WIKI_HOME_URL}>Browse on the original wiki</ButtonLink>
      </Example>
    </Specimen>
  );
}

export function Links() {
  return (
    <Specimen
      id="link"
      title="Link"
      summary="Text links (DESIGN §6.3): underlined in prose, underline on hover elsewhere, marked when external."
    >
      <Example label="In prose">
        <p className="max-w-prose text-body text-fg">
          Read the{" "}
          <Link to="/" appearance="prose">
            contributing guide
          </Link>{" "}
          first, or see the{" "}
          <Link to={WIKI_HOME_URL} appearance="prose">
            page on the original wiki
          </Link>
          .
        </p>
      </Example>
      <Example label="Standalone, external, muted">
        <Link to="/">View all help pages</Link>
        <Link to="https://creativecommons.org/licenses/by-sa/4.0/">
          CC BY-SA 4.0 licence
        </Link>
        <Link to="/" appearance="muted">
          Licence and attribution
        </Link>
      </Example>
      <Example label="A reader’s URL (nofollow ugc)">
        <Link to="https://example.org/songbook/the-long-road" userContent>
          The long road, in a community songbook
        </Link>
      </Example>
      <Example label="Current page">
        <Link to="/styleguide" current>
          Styleguide
        </Link>
      </Example>
      <Example label="Inside an alert (takes its colour)">
        <Alert tone="info" title="This page is a stub">
          <Link to="/" appearance="inherit">
            Help complete it
          </Link>
        </Alert>
      </Example>
    </Specimen>
  );
}
