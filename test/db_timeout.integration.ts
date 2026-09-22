import { describe, expect, it } from "vitest";
import { Pool } from "pg";
import { pool } from "../api/app/queries/db";
import { getConfig } from "../api/config/config";
import {
  mapDatabaseError,
  DatabaseTimeoutError,
  DatabasePoolTimeoutError,
} from "../api/app/lib/errors";

describe("Database statement timeout", () => {
  it("is cancelled by Postgres and maps to a 503", async () => {
    // Tighten statement_timeout on one checked-out connection only, so the
    // rest of the suite keeps the configured default.
    const client = await pool.connect();
    let releaseError: Error | undefined;
    try {
      await client.query("SET statement_timeout TO 50");
      let caught: unknown;
      try {
        await client.query("SELECT pg_sleep(1)");
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(Error);
      expect((caught as { code?: string }).code).toBe("57014");
      const mapped = mapDatabaseError(caught);
      expect(mapped).toBeInstanceOf(DatabaseTimeoutError);
      expect(mapped?.status).toBe(503);
      try {
        await client.query("RESET statement_timeout");
      } catch (error) {
        // Destroy rather than return a connection in an unknown state
        releaseError = error as Error;
      }
    } finally {
      client.release(releaseError);
    }
  });
});

describe("Database pool timeout", () => {
  it("maps a real pg-pool wait timeout to a 503", async () => {
    // Dedicated single-slot pool: hold its only client, then ask for another
    // so pg-pool raises its own wait-timeout error. This pins the exact error
    // pg-pool produces, so a dependency bump that rewords it fails here
    // rather than silently degrading the 503 to a 500. The timeout also
    // bounds the first physical connect, hence not making it too small.
    const { postgres } = getConfig();
    const small = new Pool({
      ...postgres,
      max: 1,
      connectionTimeoutMillis: 500,
    });
    const held = await small.connect();
    try {
      let caught: unknown;
      try {
        await small.query("SELECT 1");
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(Error);
      const mapped = mapDatabaseError(caught);
      expect(mapped).toBeInstanceOf(DatabasePoolTimeoutError);
      expect(mapped?.status).toBe(503);
    } finally {
      held.release();
      await small.end();
    }
  });
});
