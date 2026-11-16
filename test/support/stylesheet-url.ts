/**
 * What `~/styles/app.css?url` resolves to under vitest (vitest.config.ts).
 * Vitest replaces unprocessed CSS with an empty string, which would render
 * `<link rel="stylesheet" href="">`, and React warns about an empty href.
 */
export default "/assets/app-test.css";
