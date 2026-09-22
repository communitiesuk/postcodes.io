import { getConfig } from "../../config/config";
const { defaults } = getConfig();

const DEFAULT_STATUS_CODE = 500;
const DEFAULT_MESSAGE = `500 Server Error.
For an urgent fix email support@ideal-postcodes.co.uk. 
Alternatively submit an issue at https://github.com/ideal-postcodes/postcodes.io/issues
`;

/**
 * Returns an API error which can be parsed by renderer
 */
export class PostcodesioHttpError extends Error {
  //  HTTP status code
  public status: number;
  //  Error message to be returned to client
  public humanMessage: string;

  constructor(status?: number, humanMessage?: string) {
    status = status || DEFAULT_STATUS_CODE;
    humanMessage = humanMessage || DEFAULT_MESSAGE;
    const message = `PostcodesIO HTTP Error: ${status} ${humanMessage}`;
    super(message);
    // Set the prototype explicitly
    // https://github.com/Microsoft/TypeScript-wiki/blob/master/Breaking-Changes.md#extending-built-ins-like-error-array-and-map-may-no-longer-work
    // new.target keeps the subclass prototype so instanceof and name work for
    // every subclass, not only the base.
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = this.constructor.name;
    this.status = status;
    this.humanMessage = humanMessage;
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Returns JSON response which can be parsed by interpreter
   */
  toJSON() {
    return {
      status: this.status,
      error: this.humanMessage,
    };
  }
}

const INVALID_JSON_MESSAGE = `Invalid JSON submitted.
You need to submit a JSON object with an array of postcodes or geolocation objects.
Also ensure that Content-Type is set to application/json
`;

export class InvalidJsonError extends PostcodesioHttpError {
  constructor() {
    super(400, INVALID_JSON_MESSAGE);
  }
}

export class NotFoundError extends PostcodesioHttpError {
  constructor() {
    super(404, "Resource not found");
  }
}

export class InvalidPostcodeError extends PostcodesioHttpError {
  constructor() {
    super(404, "Invalid postcode");
  }
}

interface TerminatedPostcodeTuple {
  postcode: string;
  year_terminated: number;
  month_terminated: number;
  longitude: number | null;
  latitude: number | null;
}

export class PostcodeNotFoundError extends PostcodesioHttpError {
  public terminatedPostcode: TerminatedPostcodeTuple | null;

  constructor(terminatedPostcode: TerminatedPostcodeTuple | null = null) {
    super(404, "Postcode not found");
    Object.setPrototypeOf(this, PostcodeNotFoundError.prototype);
    this.terminatedPostcode = terminatedPostcode;
  }

  toJSON() {
    const terminated = this.terminatedPostcode
      ? {
          postcode: this.terminatedPostcode.postcode,
          year_terminated: this.terminatedPostcode.year_terminated,
          month_terminated: this.terminatedPostcode.month_terminated,
          longitude: this.terminatedPostcode.longitude,
          latitude: this.terminatedPostcode.latitude,
        }
      : null;

    return {
      status: this.status,
      error: this.humanMessage,
      ...(terminated !== null && { terminated }),
    };
  }
}

export class PostcodeNotInSpdError extends PostcodesioHttpError {
  constructor() {
    super(404, "Postcode exists in ONSPD but not in SPD");
  }
}
const INVALID_JSON_QUERY_MESSAGE = `Invalid JSON query submitted. 
You need to submit a JSON object with an array of postcodes or geolocation objects.
Also ensure that Content-Type is set to application/json
`;

export class InvalidJsonQueryError extends PostcodesioHttpError {
  constructor() {
    super(400, INVALID_JSON_QUERY_MESSAGE);
  }
}

export class JsonArrayRequiredError extends PostcodesioHttpError {
  constructor() {
    super(400, "Invalid data submitted. You need to provide a JSON array");
  }
}

const MAX_GEOLOCATIONS = defaults.bulkGeocode.geolocations.MAX;
const MAX_GEOLOCATIONS_MESSAGE = `Too many locations submitted. Up to ${MAX_GEOLOCATIONS} locations can be bulk requested at a time`;

export class ExceedMaxGeolocationsError extends PostcodesioHttpError {
  constructor() {
    super(400, MAX_GEOLOCATIONS_MESSAGE);
  }
}

const MAX_POSTCODES = defaults.bulkLookups.postcodes.MAX;
const MAX_POSTCODES_MESSAGE = `Too many postcodes submitted. Up to ${MAX_POSTCODES} postcodes can be bulk requested at a time`;

export class ExceedMaxPostcodesError extends PostcodesioHttpError {
  constructor() {
    super(400, MAX_POSTCODES_MESSAGE);
  }
}

export class PostcodeQueryRequiredError extends PostcodesioHttpError {
  constructor() {
    super(
      400,
      "No postcode query submitted. Remember to include query parameter"
    );
  }
}

export class InvalidGeolocationError extends PostcodesioHttpError {
  constructor() {
    super(400, "Invalid longitude/latitude submitted");
  }
}

export class InvalidLimitError extends PostcodesioHttpError {
  constructor() {
    super(400, "Invalid result limit submitted");
  }
}

export class InvalidRadiusError extends PostcodesioHttpError {
  constructor() {
    super(400, "Invalid lookup radius submitted");
  }
}

export class TPostcodeNotFoundError extends PostcodesioHttpError {
  constructor() {
    super(404, "Terminated postcode not found");
  }
}

export class PlaceNotFoundError extends PostcodesioHttpError {
  constructor() {
    super(404, "Place not found");
  }
}

export class InvalidQueryError extends PostcodesioHttpError {
  constructor() {
    super(400, "No valid query submitted. Remember to include every parameter");
  }
}

export class OutcodeNotFoundError extends PostcodesioHttpError {
  constructor() {
    super(404, "Outcode not found");
  }
}

export class NotReadyError extends PostcodesioHttpError {
  constructor() {
    super(500, "Service not ready. Database is not available");
  }
}

const DB_TIMEOUT_MESSAGE =
  "Database query timed out. Please retry the request.";

/**
 * The database cancelled the query because it exceeded statement_timeout
 * (SQLSTATE 57014). Distinct from a generic 500 so clients back off and
 * retry, and so timeouts under load are visible in logs and metrics.
 */
export class DatabaseTimeoutError extends PostcodesioHttpError {
  constructor() {
    super(503, DB_TIMEOUT_MESSAGE);
  }
}

const DB_POOL_TIMEOUT_MESSAGE =
  "Database connection pool exhausted. Please retry the request.";

/**
 * No pooled connection became available within connectionTimeoutMillis.
 */
export class DatabasePoolTimeoutError extends PostcodesioHttpError {
  constructor() {
    super(503, DB_POOL_TIMEOUT_MESSAGE);
  }
}

// SQLSTATE raised by Postgres when statement_timeout cancels a query
const PG_QUERY_CANCELED = "57014";
// Messages pg-pool raises when connectionTimeoutMillis elapses: waiting for
// a slot in a full pool, and establishing a new physical connection.
// Covered by a real pool timeout in test/db_timeout.integration.ts so a
// pg-pool bump that rewords them fails CI rather than silently returning 500.
const PG_POOL_TIMEOUT_MESSAGES = [
  "timeout exceeded when trying to connect",
  "Connection terminated due to connection timeout",
];

const SQLSTATE = /^[0-9A-Z]{5}$/;

/**
 * The SQLSTATE code carried by a node-postgres error, or undefined for
 * anything else (Node system errors and body-parser errors also carry a
 * `code`, but not in SQLSTATE shape).
 */
export const pgErrorCode = (error: unknown): string | undefined => {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && SQLSTATE.test(code) ? code : undefined;
};

/**
 * Maps a node-postgres error to an API error, or null if it is not one of
 * the timeout conditions handled here.
 */
export const mapDatabaseError = (
  error: unknown
): DatabaseTimeoutError | DatabasePoolTimeoutError | null => {
  if (!(error instanceof Error)) return null;
  if (pgErrorCode(error) === PG_QUERY_CANCELED)
    return new DatabaseTimeoutError();
  if (PG_POOL_TIMEOUT_MESSAGES.includes(error.message))
    return new DatabasePoolTimeoutError();
  return null;
};
