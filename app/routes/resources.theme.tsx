import { redirect } from "react-router";
import type { ActionFunctionArgs } from "react-router";
import { z } from "zod";
import { THEME_CHOICES } from "~/constants/theme";
import type { ProxyErrorCode } from "~/schemas/proxy";
import { assertSameOrigin } from "~/server/csrf.server";
import { jsonResponse } from "~/server/json.server";
import { safeReturnTo } from "~/server/return-to.server";
import { themeCookie } from "~/server/theme.server";

/**
 * Saves the reader's theme choice (DESIGN §6.24). The no-JS form sends a
 * `returnTo` and gets a 303 back to that page; the ThemeToggle's script
 * sends none and gets a proxy body (`{ok, data | error}`) as JSON.
 */

const NO_STORE = { "Cache-Control": "no-store" };

const themeForm = z.object({ theme: z.enum(THEME_CHOICES) });

function failure(status: number, code: ProxyErrorCode, message: string) {
  return jsonResponse(
    { ok: false as const, error: { code, message } },
    {
      status,
      headers: status === 405 ? { Allow: "POST", ...NO_STORE } : NO_STORE,
    }
  );
}

const methodNotAllowed = () =>
  failure(405, "method_not_allowed", "Save a theme with a POST request.");

const invalidTheme = () =>
  failure(400, "invalid_theme", "Choose System, Light or Dark.");

export function loader() {
  return methodNotAllowed();
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") return methodNotAllowed();
  assertSameOrigin(request);

  const form = await request.formData().catch(() => null);
  const parsed = themeForm.safeParse({ theme: form?.get("theme") });
  if (!form || !parsed.success) return invalidTheme();

  const { theme } = parsed.data;
  const headers = {
    "Set-Cookie": themeCookie(theme === "system" ? null : theme),
    ...NO_STORE,
  };
  if (form.has("returnTo")) {
    return redirect(safeReturnTo(form.get("returnTo")), {
      status: 303,
      headers,
    });
  }
  return jsonResponse({ ok: true as const, data: { theme } }, { headers });
}
