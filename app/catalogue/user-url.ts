/** A web address a reader added, safe to put in an anchor. */
type UserUrl = `http${string}`;

/**
 * Whether `url` is an absolute `http:` or `https:` URL. The API's URLs are
 * a reader's input: anything else (a `javascript:` URL, a relative path) is
 * shown as text, never as a link.
 */
export function isUserUrl(url: string): url is UserUrl {
  return /^https?:\/\//.test(url) && URL.canParse(url);
}

/**
 * The host of a reader's URL without a leading `www.`: a readable label for
 * a link. A string that isn't a URL is returned as it is.
 */
export function urlHost(url: string): string {
  return URL.canParse(url) ? new URL(url).hostname.replace(/^www\./, "") : url;
}
