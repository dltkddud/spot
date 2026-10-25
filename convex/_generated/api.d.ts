/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activity from "../activity.js";
import type * as admin from "../admin.js";
import type * as aiCheck from "../aiCheck.js";
import type * as chatRequests from "../chatRequests.js";
import type * as cleanup from "../cleanup.js";
import type * as connections from "../connections.js";
import type * as events from "../events.js";
import type * as followUps from "../followUps.js";
import type * as followUpsNode from "../followUpsNode.js";
import type * as huddles from "../huddles.js";
import type * as leaving from "../leaving.js";
import type * as matches from "../matches.js";
import type * as matchesNode from "../matchesNode.js";
import type * as profiles from "../profiles.js";
import type * as seed from "../seed.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activity: typeof activity;
  admin: typeof admin;
  aiCheck: typeof aiCheck;
  chatRequests: typeof chatRequests;
  cleanup: typeof cleanup;
  connections: typeof connections;
  events: typeof events;
  followUps: typeof followUps;
  followUpsNode: typeof followUpsNode;
  huddles: typeof huddles;
  leaving: typeof leaving;
  matches: typeof matches;
  matchesNode: typeof matchesNode;
  profiles: typeof profiles;
  seed: typeof seed;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
