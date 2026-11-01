import {
  IconDeviceFloppy,
  IconMenu2,
  IconPencil,
  IconTrash,
} from "@tabler/icons-react";
import { useEffect, useId, useRef, useState } from "react";
import { ThemeToggle } from "~/components/ThemeToggle";
import { Button } from "~/components/ui/Button";
import { Dialog } from "~/components/ui/Dialog";
import { Drawer } from "~/components/ui/Drawer";
import { Field } from "~/components/ui/Field";
import { Input } from "~/components/ui/Input";
import { Link } from "~/components/ui/Link";
import { useToast } from "~/components/ui/Toast";
import { Example, Specimen } from "./Specimen";

/** How long the demo's revoke "takes", so the pending state can be seen. */
const DEMO_PENDING_MS = 2000;

function RevokeDemo() {
  const show = useToast();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => {
      setPending(false);
      setOpen(false);
      show({ tone: "success", message: "Token revoked." });
    }, DEMO_PENDING_MS);
    return () => clearTimeout(timer);
  }, [pending, show]);

  return (
    <>
      <Button
        variant="secondary-danger"
        icon={IconTrash}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        Revoke
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Revoke this token?"
        description="Anything using ‘Laptop MCP’ will stop working straight away. This can’t be undone."
        pending={pending}
        confirm={{
          label: "Revoke token",
          icon: IconTrash,
          variant: "danger",
          onConfirm: () => setPending(true),
        }}
      />
    </>
  );
}

function RenameDemo() {
  const show = useToast();
  const [open, setOpen] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const formId = useId();
  return (
    <>
      <Button
        icon={IconPencil}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        Rename
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Rename token"
        initialFocus={field}
        confirm={{
          label: "Save name",
          icon: IconDeviceFloppy,
          variant: "primary",
          form: formId,
        }}
      >
        <form
          id={formId}
          onSubmit={event => {
            event.preventDefault();
            setOpen(false);
            show({ tone: "success", message: "Token renamed." });
          }}
        >
          <Field label="Token name" optional help="Up to 128 characters.">
            <Input ref={field} name="name" defaultValue="Laptop MCP" />
          </Field>
        </form>
      </Dialog>
    </>
  );
}

export function Dialogs() {
  return (
    <Specimen
      id="dialog"
      title="Dialog"
      summary="A modal on a native dialog (DESIGN §6.22). Focus starts on Cancel (or the first field), stays inside, and goes back to the button that opened it. Below sm the buttons stack with Cancel at the bottom."
    >
      <Example label="Destructive confirm (pending for 2 s after Revoke token)">
        <RevokeDemo />
      </Example>
      <Example label="Form (closes from the backdrop too)">
        <RenameDemo />
      </Example>
    </Specimen>
  );
}

const MENU_LINKS = [
  ["Colour", "#colour"],
  ["Button", "#button"],
  ["Field and Input", "#input"],
  ["Tabs", "#tabs"],
  ["Alert and Banner", "#alert"],
  ["Dialog", "#dialog"],
] as const;

function DrawerDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        icon={IconMenu2}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        Menu
      </Button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Site menu"
        footer={<ThemeToggle placement="drawer" />}
      >
        <nav aria-label="Styleguide sections">
          <ul role="list">
            {MENU_LINKS.map(([label, to]) => (
              // A 44 px row per item, as nav items are below lg (DESIGN §6.1).
              <li key={to} className="flex min-h-11 items-center">
                <Link to={to}>{label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </Drawer>
    </>
  );
}

export function Drawers() {
  return (
    <Specimen
      id="drawer"
      title="Drawer"
      summary="The navigation drawer (DESIGN §6.21): a bottom sheet below md, the left edge from md. It closes on Escape, the backdrop, either close button and any navigation."
    >
      <Example label="Open it">
        <DrawerDemo />
      </Example>
    </Specimen>
  );
}

export function Theme() {
  return (
    <Specimen
      id="theme-toggle"
      title="ThemeToggle"
      summary="System, Light or Dark, saved in a cookie and switched at once (DESIGN §6.24). It changes the whole site, not only this preview."
    >
      <Example label="In the header (icon-only at md, with text from lg)">
        <ThemeToggle placement="header" />
      </Example>
      <Example label="In the drawer (44 px, sharing the width)">
        <ThemeToggle placement="drawer" />
      </Example>
    </Specimen>
  );
}
