import { describe, expect, it, beforeEach, afterAll } from "vitest";
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
