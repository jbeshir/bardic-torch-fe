/**
 * The media queries of Tailwind's breakpoints that scripts need (the CSS
 * uses the `sm:` … `xl:` variants): one definition each, so a component
 * that switches on a width matches the layout that switches with it.
 */

/** From `md` (768 px): the desktop sizes, the table of contents unfolded. */
export const MD_QUERY = "(min-width: 768px)";

/** From `lg` (1024 px): the persistent sidebar. */
export const LG_QUERY = "(min-width: 1024px)";

/** From `xl` (1280 px): the filter columns beside the results. */
export const XL_QUERY = "(min-width: 1280px)";

/** Below `sm` (640 px): the toast stack at the top, full width. */
export const BELOW_SM_QUERY = "(max-width: 639px)";
