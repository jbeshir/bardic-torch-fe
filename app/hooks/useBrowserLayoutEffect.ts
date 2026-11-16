import { useEffect, useLayoutEffect } from "react";

/** A layout effect in the browser; on the server, where it can't run, none. */
export const useBrowserLayoutEffect =
  typeof document === "undefined" ? useEffect : useLayoutEffect;
