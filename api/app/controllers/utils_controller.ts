import { Handler } from "../types/express";
import { pool, query, lastQuerySuccess } from "../queries/db";
import { NotReadyError } from "../lib/errors";
import { getConfig } from "../../config/config";

const { postgres } = getConfig();

// How recent a successful query must be for a saturated pool to count as
// healthy without probing.
const RECENT_SUCCESS_MS = 10_000;

/**
 * True when every pool slot is checked out and queries are still completing,
 * i.e. the database is reachable but busy. Probing then would queue SELECT 1
 * behind real traffic and fail after connectionTimeoutMillis, so App Service
 * would recycle the busiest instances and push their load onto the rest.
 * The recent-success check stops a pool of stuck connection attempts to a
 * dead database from being reported as healthy.
 */
export const poolBusyButHealthy = (now: number = Date.now()): boolean =>
  pool.totalCount >= postgres.max &&
  pool.idleCount === 0 &&
  now - lastQuerySuccess() < RECENT_SUCCESS_MS;

export const ping: Handler = (_, response, next) => {
  response.jsonApiResponse = {
    status: 200,
    result: "pong",
  };
  next();
};

export const ready: Handler = async (_, response, next) => {
  try {
    if (!poolBusyButHealthy()) await query("SELECT 1");
  } catch (error) {
    const err = error as Error;
    console.error("[ready] Database connection failed:", err.message);
    console.error("[ready] Error stack:", err.stack);
    return next(new NotReadyError());
  }
  response.jsonApiResponse = {
    status: 200,
    result: "Ready",
  };
  next();
};
