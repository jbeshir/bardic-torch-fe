import { OFFLINE } from "~/client/send-form";
import { useToast } from "~/components/ui/Toast";
import type { ProxyError } from "~/schemas/proxy";

/**
 * Raises the offline toast (DESIGN §7.3) for a failure that never reached
 * the site; the form or control shows its own inline error as well.
 */
export function useOfflineToast(): (error: ProxyError) => void {
  const show = useToast();
  return error => {
    if (error.code === OFFLINE.code) {
      show({ tone: "danger", message: OFFLINE.message });
    }
  };
}
