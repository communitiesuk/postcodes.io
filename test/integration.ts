import { describe, expect, it } from "vitest";
import request from "supertest";
import { postcodesioApplication, configFactory } from "./helper";
import { pool, query } from "../api/app/queries/db";
const app = postcodesioApplication();

describe("Pages routes", () => {
  describe("/", async () => {
    it("should return 200", async () => {
      await request(app).get("/").expect(200).expect("Content-Type", /html/);
    });
  });

  describe("/docs", () => {
    it("should return 301", async () => {
      await request(app)
        .get("/docs")
        .expect("Content-Type", /html/)
        .expect(301);
    });
  });
});

describe("Errors", () => {
  describe("404", () => {
    it("should return a 404 if page does not exist", async () => {
      await request(app)
        .get("/surely/this/pagewouldn/ot/exist")
        .expect("Content-Type", /json/)
        .expect(404);
    });
  });
});

describe("Utils", () => {
  describe("Health", () => {
    it("should return 200 if DB available", async () => {
      const { body } = await request(app)
        .get("/ready")
        .expect(200)
        .expect("Content-Type", /json/);
      expect(body.result).toBe("Ready");
    });

    it("should return 200 without queueing when the pool is busy but healthy", async () => {
      // Check out every slot so a SELECT 1 would have to wait
      // connectionTimeoutMillis (5s) and then fail; /ready must answer from
      // the recent successful query instead.
      const { postgres } = configFactory();
      await query("SELECT 1");
      const held = await Promise.all(
        Array.from({ length: postgres.max }, () => pool.connect())
      );
      try {
        const started = Date.now();
        const { body } = await request(app).get("/ready").expect(200);
        expect(body.result).toBe("Ready");
        expect(Date.now() - started).toBeLessThan(1000);
      } finally {
        held.forEach((client) => client.release());
      }
    });
  });
  describe("Ping", () => {
    it("should pong", async () => {
      const { body } = await request(app)
        .get("/ping")
        .expect(200)
        .expect("Content-Type", /json/);
      expect(body.result).toBe("pong");
    });
  });
});

describe("httpHeaders", () => {
  it("sets arbitrary headers on all HTTP responses", async () => {
    const config = configFactory();
    config.httpHeaders = { foo: "bar" };
    const newApp = postcodesioApplication(config);
    await request(newApp).get("/ping").expect("foo", "bar").expect(200);
  });
});
