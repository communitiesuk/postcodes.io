/**
 * This file exports default configurations across test, development and
 * production environments. If you wish to modify configuration, please use
 * environment variables or the .env file
 *
 * Nota Bene
 *
 * Whereas previously (<10.1), config.js served as an editable configuration
 * file, post 10.1, configuration should be set via environment variables
 * or the `.env` file - with environment variables taking precedence
 */

// Load .env into environment variables

import { config as dotenv } from "dotenv";
dotenv();

import { join } from "node:path";
import { defaults } from "./defaults";

const defaultEnv = process.env.NODE_ENV || "development";

export type Env = "development" | "test" | "production";

interface PostgresConfig {
  user: string;
  password: string;
  database: string;
  host: string;
  port: number;
  /** Maximum connections in the pg Pool. Env: POSTGRES_POOL_MAX */
  max: number;
  /**
   * Server-side statement_timeout (ms) set on every pooled connection, so a
   * runaway query is cancelled by Postgres rather than holding a connection.
   * 0 disables it. Env: POSTGRES_STATEMENT_TIMEOUT
   */
  statement_timeout: number;
  /**
   * How long (ms) a query may wait for a database connection before failing
   * with a 503 rather than queueing without bound. pg-pool applies it both to
   * waiting for a slot when the pool is full and to establishing a new
   * physical connection (TLS, auth and, with Azure AD, the token fetch).
   * 0 disables. Env: POSTGRES_CONNECTION_TIMEOUT
   */
  connectionTimeoutMillis: number;
}

interface LogConfig {
  name: string;
  file: string;
}

export interface Config {
  googleAnalyticsKey: string;
  postgres: PostgresConfig;
  log: LogConfig;
  host: string;
  port: number;
  urlPrefix: string;
  defaults: any;
  httpHeaders?: Record<string, string>;
  corsAllowedOrigins?: string[];
  prometheusUsername?: string;
  prometheusPassword?: string;
}

const config: Record<Env, Config> = {
  development: {
    googleAnalyticsKey: "",
    postgres: {
      user: "postcodesio",
      password: "password",
      database: "postcodesiodb", // Database name
      host: "localhost",
      port: 5432,
      max: 10,
      statement_timeout: 5000,
      connectionTimeoutMillis: 5000,
    },
    log: {
      name: "postcodes.io",
      file: "stdout",
    },
    host: "0.0.0.0",
    port: 8000,
    urlPrefix: "",
    defaults,
  },

  test: {
    googleAnalyticsKey: "",
    postgres: {
      user: "postcodesio",
      password: "password",
      database: "postcodeio_testing",
      host: "localhost",
      port: 5432,
      max: 10,
      statement_timeout: 5000,
      connectionTimeoutMillis: 5000,
    },
    log: {
      name: "postcodes.io",
      file: join(__dirname, "../test.log"),
    },
    host: "0.0.0.0",
    port: 8000,
    urlPrefix: "",
    defaults,
  },

  production: {
    googleAnalyticsKey: "",
    postgres: {
      user: "postcodesio",
      password: "password",
      database: "postcodesiodb",
      host: "localhost",
      port: 5432,
      max: 10,
      statement_timeout: 5000,
      connectionTimeoutMillis: 5000,
    },
    log: {
      name: "postcodes.io",
      file: "perf", // Use pino.extreme
    },
    host: "0.0.0.0",
    port: 8000,
    urlPrefix: "",
    defaults,
  },
};

/**
 * Parse an integer environment variable, rejecting anything that is not a
 * plain non-negative integer literal at or above `min`. A bare parseInt would
 * turn "5s" into 5, "abc" into NaN and accept negatives, each of which pg
 * either silently ignores or rejects at connection time.
 */
const parseIntegerEnv = (name: string, value: string, min: number): number => {
  const n = /^\d+$/.test(value.trim()) ? parseInt(value, 10) : NaN;
  if (!Number.isInteger(n) || n < min) {
    throw new Error(
      `Invalid ${name}: expected an integer >= ${min}, got "${value}"`
    );
  }
  return n;
};

export const getConfig = (env?: Env): Config => {
  const environment = env || defaultEnv;

  const cfg = config[environment as Env];

  const {
    HOST,
    PORT,
    POSTGRES_USER,
    POSTGRES_PASSWORD,
    POSTGRES_DATABASE,
    POSTGRES_HOST,
    POSTGRES_PORT,
    POSTGRES_POOL_MAX,
    POSTGRES_STATEMENT_TIMEOUT,
    POSTGRES_CONNECTION_TIMEOUT,
    LOG_NAME,
    GA_KEY,
    LOG_DESTINATION,
    PROMETHEUS_USERNAME,
    PROMETHEUS_PASSWORD,
    HTTP_HEADERS,
    URL_PREFIX,
    CORS_ALLOWED_ORIGINS,
  } = process.env;

  if (HOST !== undefined) cfg.host = HOST;
  if (PORT !== undefined) cfg.port = parseInt(PORT, 10);

  if (POSTGRES_USER !== undefined) cfg.postgres.user = POSTGRES_USER;
  if (POSTGRES_PASSWORD !== undefined)
    cfg.postgres.password = POSTGRES_PASSWORD;
  if (POSTGRES_DATABASE !== undefined)
    cfg.postgres.database = POSTGRES_DATABASE;
  if (POSTGRES_HOST !== undefined) cfg.postgres.host = POSTGRES_HOST;
  if (POSTGRES_PORT !== undefined)
    cfg.postgres.port = parseInt(POSTGRES_PORT, 10);
  if (POSTGRES_POOL_MAX !== undefined)
    cfg.postgres.max = parseIntegerEnv(
      "POSTGRES_POOL_MAX",
      POSTGRES_POOL_MAX,
      1
    );
  if (POSTGRES_STATEMENT_TIMEOUT !== undefined)
    cfg.postgres.statement_timeout = parseIntegerEnv(
      "POSTGRES_STATEMENT_TIMEOUT",
      POSTGRES_STATEMENT_TIMEOUT,
      0
    );
  if (POSTGRES_CONNECTION_TIMEOUT !== undefined)
    cfg.postgres.connectionTimeoutMillis = parseIntegerEnv(
      "POSTGRES_CONNECTION_TIMEOUT",
      POSTGRES_CONNECTION_TIMEOUT,
      0
    );

  if (LOG_NAME !== undefined) cfg.log.name = LOG_NAME;
  if (LOG_DESTINATION !== undefined) cfg.log.file = LOG_DESTINATION;

  if (GA_KEY !== undefined) cfg.googleAnalyticsKey = GA_KEY;

  if (PROMETHEUS_USERNAME !== undefined)
    cfg.prometheusUsername = PROMETHEUS_USERNAME;
  if (PROMETHEUS_PASSWORD !== undefined)
    cfg.prometheusPassword = PROMETHEUS_PASSWORD;

  if (URL_PREFIX !== undefined) cfg.urlPrefix = URL_PREFIX;

  if (CORS_ALLOWED_ORIGINS !== undefined)
    cfg.corsAllowedOrigins = CORS_ALLOWED_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);

  try {
    if (HTTP_HEADERS !== undefined) cfg.httpHeaders = JSON.parse(HTTP_HEADERS);
  } catch (error) {
    process.stdout.write(
      "Invalid HTTP Header configuration. Please supply valid JSON string for HTTP_HEADERS"
    );
    throw error;
  }

  return cfg;
};
