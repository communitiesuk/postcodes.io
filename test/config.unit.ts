import { describe, expect, it, beforeEach, afterEach, afterAll } from "vitest";
import { configFactory } from "./helper";

describe("Config", () => {
  describe("Environment variables", () => {
    const ENV = process.env;

    beforeEach(() => {
      process.env = {};
    });

    afterAll(() => {
      process.env = ENV;
    });

    describe("HTTP_HEADERS", () => {
      it("is undefined by default", () => {
        expect(configFactory().httpHeaders).toBeUndefined();
      });

      it("assigns httpHeaders", () => {
        const headers = {
          foo: "bar",
          baz: "quux",
        };
        process.env["HTTP_HEADERS"] = JSON.stringify(headers);
        expect(configFactory().httpHeaders).toEqual(headers);
      });

      it("throws if invalid httpHeader string", () => {
        process.env["HTTP_HEADERS"] = "foo";
        expect(configFactory).toThrow();
      });
    });

    describe("Postgres pool settings", () => {
      // getConfig mutates the shared config object, so put the two fields
      // back after each test rather than relying on declaration order.
      afterEach(() => {
        delete process.env["POSTGRES_POOL_MAX"];
        delete process.env["POSTGRES_STATEMENT_TIMEOUT"];
        delete process.env["POSTGRES_CONNECTION_TIMEOUT"];
        const { postgres } = configFactory();
        postgres.max = 10;
        postgres.statement_timeout = 5000;
        postgres.connectionTimeoutMillis = 5000;
      });

      it("defaults POSTGRES_CONNECTION_TIMEOUT to 5000ms", () => {
        expect(configFactory().postgres.connectionTimeoutMillis).toBe(5000);
      });

      it("assigns connectionTimeoutMillis from POSTGRES_CONNECTION_TIMEOUT", () => {
        process.env["POSTGRES_CONNECTION_TIMEOUT"] = "1500";
        expect(configFactory().postgres.connectionTimeoutMillis).toBe(1500);
      });

      it.each(["abc", "-1", "2s"])(
        "rejects POSTGRES_CONNECTION_TIMEOUT=%j",
        (value) => {
          process.env["POSTGRES_CONNECTION_TIMEOUT"] = value;
          expect(() => configFactory()).toThrow(/POSTGRES_CONNECTION_TIMEOUT/);
        }
      );

      it("defaults POSTGRES_POOL_MAX to 10", () => {
        expect(configFactory().postgres.max).toBe(10);
      });

      it("defaults POSTGRES_STATEMENT_TIMEOUT to 5000ms", () => {
        expect(configFactory().postgres.statement_timeout).toBe(5000);
      });

      it("assigns pool max from POSTGRES_POOL_MAX", () => {
        process.env["POSTGRES_POOL_MAX"] = "25";
        expect(configFactory().postgres.max).toBe(25);
      });

      it("assigns statement_timeout from POSTGRES_STATEMENT_TIMEOUT", () => {
        process.env["POSTGRES_STATEMENT_TIMEOUT"] = "2500";
        expect(configFactory().postgres.statement_timeout).toBe(2500);
      });

      it("allows statement_timeout to be disabled with 0", () => {
        process.env["POSTGRES_STATEMENT_TIMEOUT"] = "0";
        expect(configFactory().postgres.statement_timeout).toBe(0);
      });

      it.each(["abc", "5s", "-1", "", "1.5"])(
        "rejects POSTGRES_STATEMENT_TIMEOUT=%j",
        (value) => {
          process.env["POSTGRES_STATEMENT_TIMEOUT"] = value;
          expect(() => configFactory()).toThrow(/POSTGRES_STATEMENT_TIMEOUT/);
        }
      );

      it.each(["0", "-5", "ten", ""])(
        "rejects POSTGRES_POOL_MAX=%j",
        (value) => {
          process.env["POSTGRES_POOL_MAX"] = value;
          expect(() => configFactory()).toThrow(/POSTGRES_POOL_MAX/);
        }
      );
    });

    describe("CORS_ALLOWED_ORIGINS", () => {
      it("is undefined by default", () => {
        expect(configFactory().corsAllowedOrigins).toBeUndefined();
      });

      it("assigns corsAllowedOrigins from a comma-separated list", () => {
        process.env["CORS_ALLOWED_ORIGINS"] =
          "https://foo.example.com, https://bar.example.com";
        expect(configFactory().corsAllowedOrigins).toEqual([
          "https://foo.example.com",
          "https://bar.example.com",
        ]);
      });

      it("ignores empty entries", () => {
        process.env["CORS_ALLOWED_ORIGINS"] = "https://foo.example.com,,";
        expect(configFactory().corsAllowedOrigins).toEqual([
          "https://foo.example.com",
        ]);
      });
    });
  });
});
