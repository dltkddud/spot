import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Demo guests: Logan always just updated, Jimin always over 15 minutes.
crons.interval("demo people update times", { minutes: 1 }, internal.demoPeople.keepTimes, {});

export default crons;
