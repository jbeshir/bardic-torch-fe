/** An absolute web address, the only kind a reader's link may be. */
type WebUrl = `http${string}`;

/** Whether `url` is an http(s) address (anything else is never a link). */
export function isWebUrl(url: string): url is WebUrl {
  return /^https?:\/\//i.test(url);
}
