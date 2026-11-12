/** The moderators' pages (plan §5.4); the account menu links the queue. */

export const MODERATION_PATH = "/moderation";
export const CONTACT_INBOX_PATH = "/moderation/contact";
export const TAKEDOWN_PATH = "/moderation/links";
export const BLOCKING_PATH = "/moderation/users";

/** A revision's review page. */
export const reviewPath = (id: number | string) =>
  `${MODERATION_PATH}/revisions/${id}`;
