import { describe, expect, it } from "vitest";
import { pool } from "../api/app/queries/db";
import { mapDatabaseError, DatabaseTimeoutError } from "../api/app/lib/errors";

describe("Database statement timeout", () => {
  it("is cancelled by Postgres and maps to a 503", async () => {
    // Tighten statement_timeout on one checked-out connection only, so the
    // rest of the suite keeps the configured default.
    const client = await pool.connect();
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
    } finally {
      await client.query("RESET statement_timeout");
      client.release();
    }
  });
});
