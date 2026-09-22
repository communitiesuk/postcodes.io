import { Express } from "express";
import { logger } from "../app/lib/logger";
import { filter } from "./filter";
import { Handler, Response, Request, Next } from "../app/types/express";
import {
  PostcodesioHttpError,
  InvalidJsonError,
  NotFoundError,
  DatabasePoolTimeoutError,
  mapDatabaseError,
  pgErrorCode,
} from "../app/lib/errors";
import { getConfig } from "./config";

const { postgres } = getConfig();
// A pool-wait timeout means the client already waited connectionTimeoutMillis
// for a slot; retrying after 1s would re-enter the same saturated pool.
const poolRetryAfterSeconds = Math.max(
  1,
  Math.ceil(postgres.connectionTimeoutMillis / 1000)
);

const genericError = new PostcodesioHttpError();
const invalidJsonError = new InvalidJsonError();
const notFoundError = new NotFoundError();

/**
 * Returns JSON response on behalf of routes that return `response.jsonApiResponse`
 *
 * CORS is enabled at this layer.
 * If JSONP is detected, a 200 response is returned regardless of success.
 */
const renderer: Handler = (request, response, next) => {
  const jsonResponse = response.jsonApiResponse;
  if (!jsonResponse) return next();
  if (request.query.callback) return response.status(200).jsonp(jsonResponse);
  return response.status(jsonResponse.status).json(jsonResponse);
};

/**
 * Applies an instance of PostcodesioHttpError to a response
 */
const applyError = (res: Response, err: PostcodesioHttpError) =>
  res.status(err.status).json(err.toJSON());

/**
 * Handles Requests that have resulted in an error. Invoked by next(someError)
 */
const errorRenderer = (
  error: Error,
  request: Request,
  response: Response,
  next: Next
) => {
  /*jshint unused: false */
  const databaseError = mapDatabaseError(error);
  const isPoolTimeout = databaseError instanceof DatabasePoolTimeoutError;
  const pgCode = pgErrorCode(error);
  logger.error({
    error: error.message,
    ...(pgCode !== undefined && { pg_code: pgCode }),
    ...(databaseError !== null && {
      db_timeout: isPoolTimeout ? "pool" : "statement",
    }),
  });

  // Query cancelled by statement_timeout, or no pooled connection within
  // connectionTimeoutMillis: tell the client to back off and retry.
  if (databaseError !== null) {
    response.set(
      "Retry-After",
      String(isPoolTimeout ? poolRetryAfterSeconds : 1)
    );
    return applyError(response, databaseError);
  }

  //check if bodyParser.json() fails to parse JSON request
  if (
    error instanceof SyntaxError &&
    (error as any).status === 400 &&
    request.method === "POST"
  )
    return applyError(response, invalidJsonError);

  if (error instanceof PostcodesioHttpError) return applyError(response, error);

  // Return 500 for all other errors
  return applyError(response, genericError);
};

/**
 *	Handles requests that have fallen through middleware stack by returning a 404
 */
const notFoundRenderer = (_: unknown, res: Response) =>
  applyError(res, notFoundError);

export const rendererConfig = (app: Express) => {
  app.use(filter);
  app.use(renderer);
  app.use(errorRenderer as any);
  app.use(notFoundRenderer as any);
};
