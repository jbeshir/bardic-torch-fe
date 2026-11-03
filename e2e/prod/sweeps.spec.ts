import { sweepJourneyPages } from "../support/journey-pages";
import { test } from "../support/test";

// The layout sweep of every journey page of this phase, from the one table
// in support/journey-pages.ts. Each test opens its own page.
test.describe.configure({ mode: "parallel" });

sweepJourneyPages("prod");
