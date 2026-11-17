import type { BrowserOptions } from "@sentry/react";

/**
 * What the Sentry SDKs may collect, in the Worker and in the browser alike:
 * nothing about the reader or the request. No user fields or IP address,
 * no cookies, no headers, no request or response bodies (the settings and
 * token forms, Auth0's token answers), no query strings, and no data of the
 * integrations FE never uses. Every key of the SDK's `DataCollection` is
 * set, to its off value, because the SDK's defaults collect all of them.
 */
export const SENTRY_DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
  mcp: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
  frameContextLines: 0,
} as const satisfies Required<NonNullable<BrowserOptions["dataCollection"]>>;
