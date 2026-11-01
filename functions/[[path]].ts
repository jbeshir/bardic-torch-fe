import * as build from "server-build";
import { createPagesHandler } from "../app/server/pages-function.server";

export const onRequest = createPagesHandler(build);
